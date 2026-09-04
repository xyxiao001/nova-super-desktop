"use client";

import {
  AnimationState,
  AnimationStateData,
  Physics,
  SceneRenderer,
  Skeleton,
} from "@esotericsoftware/spine-webgl";
import { useEffect, useRef, useState } from "react";
import type { FrontlineHeroDefinition } from "./frontlineRoster";
import {
  applyFrontlineActorSkin,
  loadFrontlineSpineActor,
  type FrontlineSpineAsset,
} from "./frontlineSpine";

const LOGICAL_WIDTH = 720;
const LINEUP_HEIGHT = 328;
const DETAIL_HEIGHT = 360;

type StageVariant = "lineup" | "detail";

type FrontlineHeroStageProps = {
  heroes: readonly FrontlineHeroDefinition[];
  variant: StageVariant;
  label: string;
  actorScale?: number;
};

type StageActor = {
  skeleton: Skeleton;
  animationState: AnimationState;
  centerX: number;
  bottomY: number;
  x: number;
  baseline: number;
};

const actorPosition = (
  index: number,
  count: number,
  variant: StageVariant,
) => {
  if (variant === "detail") return LOGICAL_WIDTH / 2;
  const lineupPositions = [110, 280, 450, 620];
  return lineupPositions[index] ?? LOGICAL_WIDTH / Math.max(2, count);
};

const createStageActor = (
  asset: FrontlineSpineAsset,
  actorId: string,
  index: number,
  count: number,
  variant: StageVariant,
  actorScale?: number,
): StageActor => {
  const skeleton = new Skeleton(asset.data);
  applyFrontlineActorSkin(skeleton, actorId);
  const animationState = new AnimationState(new AnimationStateData(asset.data));
  animationState.setAnimation(0, "stand", true);
  animationState.apply(skeleton);
  const scale = actorScale ?? (variant === "detail" ? 360 : 230);
  skeleton.scaleX = scale;
  skeleton.scaleY = scale;
  skeleton.updateWorldTransform(Physics.none);
  const bounds = skeleton.getBoundsRect();
  return {
    skeleton,
    animationState,
    centerX: bounds.x + bounds.width / 2,
    bottomY: bounds.y,
    x: actorPosition(index, count, variant),
    baseline: variant === "detail" ? 330 : 292,
  };
};

export default function FrontlineHeroStage({
  heroes,
  variant,
  label,
  actorScale,
}: FrontlineHeroStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const actorKey = heroes.map((hero) => hero.actorId).join("|");
  const logicalHeight = variant === "detail" ? DETAIL_HEIGHT : LINEUP_HEIGHT;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || actorKey.length === 0) return;
    setStatus("loading");
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    if (!gl) {
      setStatus("error");
      return;
    }

    let active = true;
    let frameId = 0;
    let previous = performance.now();
    let loadedAssets: FrontlineSpineAsset[] = [];
    const renderer = new SceneRenderer(canvas, gl, true);
    renderer.camera.setViewport(LOGICAL_WIDTH, logicalHeight);
    renderer.camera.position.set(LOGICAL_WIDTH / 2, logicalHeight / 2, 0);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const load = async () => {
      const entries: Array<[string, FrontlineSpineAsset]> = [];
      try {
        for (const actorId of actorKey.split("|")) {
          const asset = await loadFrontlineSpineActor(gl, actorId);
          if (!active) {
            asset.texture.dispose();
            entries.forEach(([, loaded]) => loaded.texture.dispose());
            return;
          }
          entries.push([actorId, asset]);
        }
      } catch {
        entries.forEach(([, asset]) => asset.texture.dispose());
        if (active) setStatus("error");
        return;
      }

      loadedAssets = entries.map(([, asset]) => asset);
      const actors = entries.map(([actorId, asset], index) => (
        createStageActor(asset, actorId, index, entries.length, variant, actorScale)
      ));
      let ready = false;
      let renderedFrames = 0;

      const render = (now: number) => {
        if (!active) return;
        const delta = document.hidden || reduceMotion
          ? 0
          : Math.min((now - previous) / 1000, 0.05);
        previous = now;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        renderer.begin();
        for (const actor of actors) {
          actor.animationState.update(delta);
          actor.animationState.apply(actor.skeleton);
          actor.skeleton.update(delta);
          actor.skeleton.x = actor.x - actor.centerX;
          actor.skeleton.y = logicalHeight - actor.baseline - actor.bottomY;
          actor.skeleton.updateWorldTransform(Physics.update);
          renderer.drawSkeleton(actor.skeleton, true);
        }
        renderer.end();
        renderedFrames += 1;
        canvas.dataset.renderedActors = String(actors.length);
        canvas.dataset.renderedFrames = String(renderedFrames);
        if (!ready) {
          ready = true;
          setStatus("ready");
        }
        if (!reduceMotion) frameId = requestAnimationFrame(render);
      };
      frameId = requestAnimationFrame(render);
    };

    void load();
    return () => {
      active = false;
      cancelAnimationFrame(frameId);
      loadedAssets.forEach((asset) => asset.texture.dispose());
      renderer.dispose();
    };
  }, [actorKey, actorScale, logicalHeight, variant]);

  return (
    <div
      className={`hero-spine-stage ${variant}`}
      data-status={status}
      role="img"
      aria-label={label}
    >
      <canvas
        ref={canvasRef}
        width={1440}
        height={logicalHeight * 2}
        aria-hidden="true"
      />
      {status === "error" && <span role="alert">角色动画加载失败</span>}
    </div>
  );
}
