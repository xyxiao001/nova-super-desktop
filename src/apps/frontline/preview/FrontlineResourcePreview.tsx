"use client";

import "./frontlineResourcePreview.css";

import {
  AnimationState,
  AnimationStateData,
  AtlasAttachmentLoader,
  BlendMode,
  Color,
  GLTexture,
  Physics,
  SceneRenderer,
  Skeleton,
  SkeletonBinary,
  TextureAtlas,
} from "@esotericsoftware/spine-webgl";
import { useCallback, useEffect, useRef, useState } from "react";

const ASSET_ROOT = "/assets/games/frontline";
const LOGICAL_WIDTH = 900;
const LOGICAL_HEIGHT = 1600;
const ACTOR_WORLD_TO_LOGICAL_SCALE = 500;
const ACTOR_CENTER_Y = 760;
const LOOPING_ANIMATIONS = new Set(["stand", "run"]);

type PreviewState = "stand" | "run" | "attack_1" | "dead" | "particle";

type PreviewRuntime = {
  setState: (state: PreviewState) => void;
  dispose: () => void;
};

type ParticleConfig = {
  lifetime: number;
  startSize: number;
  textureSheet: {
    columns: number;
    rows: number;
    fps: number;
  };
};

const recordFrameSignature = (
  canvas: HTMLCanvasElement,
  gl: WebGLRenderingContext,
  state: PreviewState,
) => {
  const pixels = new Uint8Array(canvas.width * canvas.height * 4);
  gl.finish();
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  const background = [9, 14, 11];
  let changedSamples = 0;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < canvas.height; y += 4) {
    for (let x = 0; x < canvas.width; x += 4) {
      const offset = (y * canvas.width + x) * 4;
      const difference = Math.abs(pixels[offset] - background[0])
        + Math.abs(pixels[offset + 1] - background[1])
        + Math.abs(pixels[offset + 2] - background[2]);
      if (difference <= 24) continue;
      changedSamples += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  canvas.dataset.previewState = state;
  canvas.dataset.changedSamples = String(changedSamples);
  canvas.dataset.renderedBounds = changedSamples > 0
    ? `${minX},${minY},${maxX},${maxY}`
    : "";
};

const loadImage = (source: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.decoding = "async";
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(`Failed to load ${source}`));
  image.src = source;
});

const fetchRequired = async (source: string) => {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Failed to load ${source}: ${response.status}`);
  return response;
};

const createPreviewRuntime = async (
  canvas: HTMLCanvasElement,
  onReady: () => void,
): Promise<PreviewRuntime> => {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: true,
    premultipliedAlpha: false,
  });
  if (!gl) throw new Error("WebGL is unavailable");

  const actorRoot = `${ASSET_ROOT}/spine/monster_01_xiyi`;
  const effectRoot = `${ASSET_ROOT}/effects/monster-fireball`;
  const [atlasResponse, skeletonResponse, actorImage, effectImage, particleResponse] = await Promise.all([
    fetchRequired(`${actorRoot}/skeleton.atlas`),
    fetchRequired(`${actorRoot}/skeleton.skel`),
    loadImage(`${actorRoot}/texture.png`),
    loadImage(`${effectRoot}/texture.png`),
    fetchRequired(`${effectRoot}/particle.json`),
  ]);
  const [atlasText, skeletonBuffer, particleConfig] = await Promise.all([
    atlasResponse.text(),
    skeletonResponse.arrayBuffer(),
    particleResponse.json() as Promise<ParticleConfig>,
  ]);

  const renderer = new SceneRenderer(canvas, gl, true);
  renderer.camera.setViewport(LOGICAL_WIDTH, LOGICAL_HEIGHT);
  renderer.camera.position.set(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, 0);

  const actorTexture = new GLTexture(gl, actorImage, false);
  const effectTexture = new GLTexture(gl, effectImage, false);
  const atlas = new TextureAtlas(atlasText);
  if (atlas.pages.length !== 1) {
    throw new Error(`Expected one atlas page, found ${atlas.pages.length}`);
  }
  atlas.pages[0].setTexture(actorTexture);

  const binary = new SkeletonBinary(new AtlasAttachmentLoader(atlas));
  binary.scale = 0.01;
  const skeletonData = binary.readSkeletonData(new Uint8Array(skeletonBuffer));
  const skeleton = new Skeleton(skeletonData);
  skeleton.scaleX = ACTOR_WORLD_TO_LOGICAL_SCALE;
  skeleton.scaleY = ACTOR_WORLD_TO_LOGICAL_SCALE;
  skeleton.updateWorldTransform(Physics.none);
  const setupBounds = skeleton.getBoundsRect();
  skeleton.x = LOGICAL_WIDTH / 2 - (setupBounds.x + setupBounds.width / 2);
  skeleton.y = ACTOR_CENTER_Y - (setupBounds.y + setupBounds.height / 2);
  const animationState = new AnimationState(new AnimationStateData(skeletonData));

  let currentState: PreviewState = "stand";
  let effectStartedAt = Number.NEGATIVE_INFINITY;
  let previousTime = performance.now();
  let frameId = 0;
  let disposed = false;
  let frameSignaturePending = true;
  let ready = false;

  const setState = (nextState: PreviewState) => {
    currentState = nextState;
    frameSignaturePending = true;
    if (nextState === "particle") {
      animationState.setAnimation(0, "stand", true);
      effectStartedAt = performance.now();
      return;
    }
    animationState.setAnimation(0, nextState, LOOPING_ANIMATIONS.has(nextState));
  };

  const renderFrame = (now: number) => {
    if (disposed) return;
    const delta = Math.min((now - previousTime) / 1000, 0.05);
    previousTime = now;
    animationState.update(delta);
    animationState.apply(skeleton);
    skeleton.update(delta);
    skeleton.updateWorldTransform(Physics.update);
    skeleton.color.set(1, 1, 1, 1);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.035, 0.055, 0.045, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    renderer.begin();
    renderer.drawSkeleton(skeleton, true);

    const effectAge = (now - effectStartedAt) / 1000;
    if (currentState === "particle" && effectAge >= 0 && effectAge < particleConfig.lifetime) {
      const { columns, rows, fps } = particleConfig.textureSheet;
      const frameCount = columns * rows;
      const frame = Math.min(frameCount - 1, Math.floor(effectAge * fps));
      const column = frame % columns;
      const row = Math.floor(frame / columns);
      const u = column / columns;
      const v = row / rows;
      const size = particleConfig.startSize * 108;
      const alpha = Math.min(1, (particleConfig.lifetime - effectAge) * 4);
      renderer.batcher.setBlendMode(BlendMode.Additive, false);
      renderer.drawTextureUV(
        effectTexture,
        skeleton.x - size / 2,
        skeleton.y - size / 2,
        size,
        size,
        u,
        v,
        u + 1 / columns,
        v + 1 / rows,
        new Color(1, 1, 1, alpha),
      );
    }
    renderer.end();
    if (frameSignaturePending) {
      recordFrameSignature(canvas, gl, currentState);
      frameSignaturePending = false;
    }
    if (!ready) {
      ready = true;
      onReady();
    }
    frameId = requestAnimationFrame(renderFrame);
  };

  setState("stand");
  frameId = requestAnimationFrame(renderFrame);

  return {
    setState,
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      actorTexture.dispose();
      effectTexture.dispose();
      renderer.dispose();
    },
  };
};

const STATES: ReadonlyArray<{ id: PreviewState; label: string }> = [
  { id: "stand", label: "待机" },
  { id: "run", label: "移动" },
  { id: "attack_1", label: "攻击" },
  { id: "dead", label: "死亡" },
  { id: "particle", label: "火球粒子" },
];

export default function FrontlineResourcePreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<PreviewRuntime | null>(null);
  const [selectedState, setSelectedState] = useState<PreviewState>("stand");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let active = true;
    createPreviewRuntime(canvas, () => {
      if (active) setStatus("ready");
    }).then((runtime) => {
      if (!active) {
        runtime.dispose();
        return;
      }
      runtimeRef.current = runtime;
    }).catch(() => {
      if (active) setStatus("error");
    });
    return () => {
      active = false;
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
    };
  }, []);

  const selectState = useCallback((state: PreviewState) => {
    setSelectedState(state);
    runtimeRef.current?.setState(state);
  }, []);

  return (
    <main className="frontline-resource-preview">
      <section className="frontline-preview-stage" aria-label="前线原版动画资源预览">
        <canvas
          ref={canvasRef}
          width={LOGICAL_WIDTH}
          height={LOGICAL_HEIGHT}
          aria-label="900 乘 1600 WebGL 动画画布"
        />
        <header>
          <strong>monster_01_xiyi</strong>
          <span>Spine 4.2.33</span>
        </header>
        <nav aria-label="动画状态">
          {STATES.map((state) => (
            <button
              key={state.id}
              type="button"
              aria-pressed={selectedState === state.id}
              disabled={status !== "ready"}
              onClick={() => selectState(state.id)}
            >
              {state.label}
            </button>
          ))}
        </nav>
        <output aria-live="polite">
          {status === "loading" && "正在校验原版资源"}
          {status === "ready" && `${selectedState} · WebGL`}
          {status === "error" && "资源契约校验失败"}
        </output>
      </section>
    </main>
  );
}
