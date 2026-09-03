"use client";

import {
  AnimationState,
  AnimationStateData,
  AtlasAttachmentLoader,
  GLTexture,
  Physics,
  SceneRenderer,
  Skeleton,
  SkeletonBinary,
  TextureAtlas,
  type SkeletonData,
} from "@esotericsoftware/spine-webgl";
import {
  useEffect,
  useRef,
} from "react";
import {
  FIXED_STEP_SECONDS,
  MAX_STEPS_PER_FRAME,
  pathPosition,
  stepBattle,
  type ActorAnimation,
  type BattleState,
  type Point,
} from "./frontlineCore";

const LOGICAL_WIDTH = 900;
const LOGICAL_HEIGHT = 1600;
const ACTOR_SCALE = 100;
const ASSET_ROOT = "/assets/games/frontline";

const ACTOR_ROOTS: Record<string, string> = {
  "hero-01-fashi": "hero_01_fashi",
  "hero-02-paoshou": "hero_02_paoshou",
  "hero-03-qishi": "hero_03_qishi",
  "hero-04-sheshou": "hero_04_sheshou",
  "monster-01-jiachong": "monster_01_jiachong",
  "monster-01-xiyi": "monster_01_xiyi",
  "monster-01-zongquan": "monster_01_zongquan",
};

type LoadedActor = {
  data: SkeletonData;
  texture: GLTexture;
};

type ActorView = {
  skeleton: Skeleton;
  animationState: AnimationState;
  animation: ActorAnimation;
  centerX: number;
  bottomY: number;
};

type BattleCanvasProps = {
  initialBattle: BattleState;
  speed: 1 | 2;
  paused: boolean;
  onSnapshot: (state: BattleState) => void;
  onReady: () => void;
  onError: (message: string) => void;
};

const fetchRequired = async (source: string) => {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Failed to load ${source}: ${response.status}`);
  return response;
};

const loadImage = (source: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.decoding = "async";
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(`Failed to load ${source}`));
  image.src = source;
});

const setAnimation = (view: ActorView, animation: ActorAnimation) => {
  if (view.animation === animation) return;
  view.animation = animation;
  view.animationState.setAnimation(
    0,
    animation,
    animation === "stand" || animation === "run",
  );
};

const createActorView = (asset: LoadedActor): ActorView => {
  const skeleton = new Skeleton(asset.data);
  skeleton.scaleX = ACTOR_SCALE;
  skeleton.scaleY = ACTOR_SCALE;
  skeleton.updateWorldTransform(Physics.none);
  const bounds = skeleton.getBoundsRect();
  const animationState = new AnimationState(new AnimationStateData(asset.data));
  animationState.setAnimation(0, "stand", true);
  return {
    skeleton,
    animationState,
    animation: "stand",
    centerX: bounds.x + bounds.width / 2,
    bottomY: bounds.y,
  };
};

const placeActor = (view: ActorView, point: Point) => {
  view.skeleton.x = point.x - view.centerX;
  view.skeleton.y = LOGICAL_HEIGHT - point.y - view.bottomY;
};

const drawHealthBars = (
  context: CanvasRenderingContext2D,
  battle: BattleState,
) => {
  context.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  for (const enemy of battle.enemies) {
    if (enemy.animation === "dead") continue;
    const point = pathPosition(battle.config.path, enemy.distance);
    const width = enemy.monsterId === 3001 ? 76 : 54;
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    context.fillStyle = "rgba(30, 20, 15, .82)";
    context.fillRect(point.x - width / 2, point.y - 54, width, 7);
    context.fillStyle = ratio > 0.35 ? "#72d94b" : "#e44b3c";
    context.fillRect(point.x - width / 2 + 2, point.y - 52, (width - 4) * ratio, 3);
  }
};

export default function BattleCanvas({
  initialBattle,
  speed,
  paused,
  onSnapshot,
  onReady,
  onError,
}: BattleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const battleRef = useRef(initialBattle);
  const speedRef = useRef(speed);
  const pausedRef = useRef(paused);
  const snapshotRef = useRef(onSnapshot);

  speedRef.current = speed;
  pausedRef.current = paused;
  snapshotRef.current = onSnapshot;

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    const overlayContext = overlay.getContext("2d");
    if (!gl || !overlayContext) throw new Error("Battle canvas is unavailable");

    let active = true;
    let frameId = 0;
    let previous = performance.now();
    let accumulator = 0;
    let snapshotElapsed = 0;
    let lastReportedStatus = battleRef.current.status;
    const views = new Map<string, ActorView>();
    const textures: GLTexture[] = [];
    const renderer = new SceneRenderer(canvas, gl, true);
    renderer.camera.setViewport(LOGICAL_WIDTH, LOGICAL_HEIGHT);
    renderer.camera.position.set(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, 0);

    const loadActors = async () => {
      const loadedEntries = await Promise.all(
        Object.entries(ACTOR_ROOTS).map(async ([actorId, directory]) => {
          const root = `${ASSET_ROOT}/spine/${directory}`;
          const [atlasResponse, skeletonResponse, image] = await Promise.all([
            fetchRequired(`${root}/skeleton.atlas`),
            fetchRequired(`${root}/skeleton.skel`),
            loadImage(`${root}/texture.png`),
          ]);
          const [atlasText, skeletonBuffer] = await Promise.all([
            atlasResponse.text(),
            skeletonResponse.arrayBuffer(),
          ]);
          const texture = new GLTexture(gl, image, false);
          textures.push(texture);
          const atlas = new TextureAtlas(atlasText);
          if (atlas.pages.length !== 1) {
            throw new Error(`${actorId} has ${atlas.pages.length} atlas pages`);
          }
          atlas.pages[0].setTexture(texture);
          const binary = new SkeletonBinary(new AtlasAttachmentLoader(atlas));
          binary.scale = 0.01;
          return [
            actorId,
            {
              data: binary.readSkeletonData(new Uint8Array(skeletonBuffer)),
              texture,
            },
          ] as const;
        }),
      );
      return new Map(loadedEntries);
    };

    const render = (assets: Map<string, LoadedActor>, now: number) => {
      if (!active) return;
      const frameSeconds = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      const simulationSeconds = pausedRef.current || document.hidden
        ? 0
        : frameSeconds * speedRef.current;
      accumulator += simulationSeconds;
      let steps = 0;
      while (accumulator >= FIXED_STEP_SECONDS && steps < MAX_STEPS_PER_FRAME) {
        battleRef.current = stepBattle(battleRef.current);
        accumulator -= FIXED_STEP_SECONDS;
        snapshotElapsed += FIXED_STEP_SECONDS;
        steps += 1;
      }
      if (steps === MAX_STEPS_PER_FRAME) accumulator = 0;

      const battle = battleRef.current;
      const activeKeys = new Set<string>();
      const renderItems: Array<{ key: string; actorId: string; point: Point; animation: ActorAnimation }> = [];
      for (const defender of battle.defenders) {
        const slot = battle.config.towerSlots.find(
          (candidate) => candidate.index === defender.slotIndex,
        );
        if (!slot) continue;
        renderItems.push({
          key: `defender-${defender.id}`,
          actorId: defender.actorId,
          point: slot.position,
          animation: defender.animation,
        });
      }
      for (const enemy of battle.enemies) {
        renderItems.push({
          key: `enemy-${enemy.id}`,
          actorId: enemy.actorId,
          point: pathPosition(battle.config.path, enemy.distance),
          animation: enemy.animation,
        });
      }
      renderItems.sort((left, right) => left.point.y - right.point.y);

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      renderer.begin();
      for (const item of renderItems) {
        activeKeys.add(item.key);
        let view = views.get(item.key);
        if (!view) {
          const asset = assets.get(item.actorId);
          if (!asset) continue;
          view = createActorView(asset);
          views.set(item.key, view);
        }
        setAnimation(view, item.animation);
        view.animationState.update(simulationSeconds);
        view.animationState.apply(view.skeleton);
        view.skeleton.update(simulationSeconds);
        placeActor(view, item.point);
        view.skeleton.updateWorldTransform(Physics.update);
        renderer.drawSkeleton(view.skeleton, true);
      }
      renderer.end();
      for (const key of views.keys()) {
        if (!activeKeys.has(key)) views.delete(key);
      }
      drawHealthBars(overlayContext, battle);

      if (snapshotElapsed >= 0.1 || battle.status !== lastReportedStatus) {
        snapshotElapsed = 0;
        lastReportedStatus = battle.status;
        snapshotRef.current(battle);
      }
      frameId = requestAnimationFrame((time) => render(assets, time));
    };

    const handleVisibilityChange = () => {
      previous = performance.now();
      accumulator = 0;
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    loadActors()
      .then((assets) => {
        if (!active) return;
        onReady();
        frameId = requestAnimationFrame((time) => render(assets, time));
      })
      .catch((error: unknown) => {
        if (active) {
          onError(error instanceof Error ? error.message : "Battle renderer failed");
        }
      });

    return () => {
      active = false;
      cancelAnimationFrame(frameId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      textures.forEach((texture) => texture.dispose());
      renderer.dispose();
    };
  }, [initialBattle, onError, onReady]);

  return (
    <div className="battle-canvas" aria-label="第一关战场">
      <canvas ref={canvasRef} width={1800} height={3200} />
      <canvas ref={overlayRef} width={900} height={1600} />
    </div>
  );
}
