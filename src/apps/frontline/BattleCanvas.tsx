"use client";

import {
  AnimationState,
  AnimationStateData,
  Physics,
  SceneRenderer,
  Skeleton,
} from "@esotericsoftware/spine-webgl";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  FIXED_STEP_SECONDS,
  MAX_STEPS_PER_FRAME,
  closestPathPoint,
  moveLord,
  moveOrMergeDefender,
  pathDirection,
  pathPosition,
  stepBattle,
  strengthenBattle,
  summonHero,
  type ActorAnimation,
  type BattleState,
  type Point,
} from "./frontlineCore";
import {
  applyFrontlineActorSkin,
  FRONTLINE_ACTOR_DIRECTORIES,
  loadFrontlineSpineActor,
  type FrontlineSpineAsset,
} from "./frontlineSpine";

const LOGICAL_WIDTH = 900;
const LOGICAL_HEIGHT = 1600;
const ACTOR_SCALE = 100;

type ActorView = {
  skeleton: Skeleton;
  animationState: AnimationState;
  animation: ActorAnimation;
  centerX: number;
  bottomY: number;
  facingX: -1 | 1;
};

type BattleCanvasProps = {
  initialBattle: BattleState;
  command: BattleCommand | null;
  speed: 1 | 2;
  paused: boolean;
  onSnapshot: (state: BattleState) => void;
  onReady: () => void;
  onError: (message: string) => void;
};

export type BattleCommand =
  | { sequence: number; type: "summon"; heroId: string }
  | { sequence: number; type: "strengthen" }
  | { sequence: number; type: "move-lord"; target: Point }
  | {
    sequence: number;
    type: "move-defender";
    defenderId: number;
    targetSlotIndex: number;
  };

const commandBattle = (battle: BattleState, command: BattleCommand) => {
  if (command.type === "summon") return summonHero(battle, command.heroId);
  if (command.type === "strengthen") return strengthenBattle(battle);
  if (command.type === "move-lord") return moveLord(battle, command.target);
  return moveOrMergeDefender(
    battle,
    command.defenderId,
    command.targetSlotIndex,
  );
};

const setAnimation = (view: ActorView, animation: ActorAnimation) => {
  if (view.animation === animation) return;
  view.animation = animation;
  view.animationState.setAnimation(
    0,
    animation,
    animation === "stand" || animation === "run",
  );
};

const createActorView = (
  asset: FrontlineSpineAsset,
  actorId: string,
): ActorView => {
  const skeleton = new Skeleton(asset.data);
  applyFrontlineActorSkin(skeleton, actorId);
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
    facingX: -1,
  };
};

const placeActor = (view: ActorView, point: Point, directionX = 0) => {
  if (directionX !== 0) view.facingX = directionX < 0 ? -1 : 1;
  const scaleDirection = view.facingX > 0 ? -1 : 1;
  view.skeleton.scaleX = ACTOR_SCALE * scaleDirection;
  view.skeleton.x = point.x - view.centerX * scaleDirection;
  view.skeleton.y = LOGICAL_HEIGHT - point.y - view.bottomY;
};

const drawHealthBars = (
  context: CanvasRenderingContext2D,
  battle: BattleState,
) => {
  context.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  context.save();
  context.lineCap = "round";
  for (const pool of battle.poisonPools) {
    const alpha = Math.min(0.55, pool.remaining / 6 * 0.55);
    context.beginPath();
    context.ellipse(
      pool.position.x,
      pool.position.y - 8,
      pool.radius,
      pool.radius * 0.42,
      0,
      0,
      Math.PI * 2,
    );
    context.fillStyle = `rgba(57, 210, 65, ${alpha})`;
    context.shadowColor = "#3bd24d";
    context.shadowBlur = 10;
    context.fill();
  }
  context.shadowBlur = 0;
  for (const projectile of battle.projectiles) {
    if (projectile.movementScale === null) continue;
    context.beginPath();
    context.arc(
      projectile.position.x,
      projectile.position.y - 30,
      projectile.impactType === "poison-area" ? 9 : 7,
      0,
      Math.PI * 2,
    );
    context.fillStyle = projectile.impactType === "poison-area"
      ? "#7fe337"
      : "#86dfff";
    context.shadowColor = projectile.impactType === "poison-area"
      ? "#39c934"
      : "#3bbcff";
    context.shadowBlur = 9;
    context.fill();
  }
  context.shadowBlur = 0;
  for (const arc of battle.lightningArcs) {
    context.beginPath();
    context.moveTo(arc.from.x, arc.from.y - 30);
    context.lineTo(arc.to.x, arc.to.y - 30);
    context.shadowColor = "#2baaff";
    context.shadowBlur = 12;
    context.lineWidth = 7;
    context.strokeStyle = "#48bfff";
    context.stroke();
    context.shadowBlur = 0;
    context.lineWidth = 2;
    context.strokeStyle = "#e9ffff";
    context.stroke();
  }
  context.restore();
  const lord = battle.defenders.find((defender) => defender.kind === "lord");
  if (lord?.moveTarget) {
    const { x, y } = lord.moveTarget;
    context.strokeStyle = "rgba(83, 53, 27, .92)";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(x, y - 48);
    context.lineTo(x, y + 4);
    context.stroke();
    context.fillStyle = "#f4c84f";
    context.beginPath();
    context.moveTo(x + 2, y - 47);
    context.lineTo(x + 34, y - 34);
    context.lineTo(x + 2, y - 20);
    context.closePath();
    context.fill();
  }
  context.textAlign = "center";
  context.font = "bold 18px sans-serif";
  context.fillStyle = "#ffd85e";
  context.strokeStyle = "rgba(68, 39, 18, .95)";
  context.lineWidth = 4;
  for (const defender of battle.defenders) {
    if (defender.kind !== "hero" || defender.slotIndex === null) continue;
    const slot = battle.config.towerSlots.find(
      (candidate) => candidate.index === defender.slotIndex,
    );
    if (!slot) continue;
    const stars = "★".repeat(defender.step);
    context.strokeText(stars, slot.position.x, slot.position.y - 58);
    context.fillText(stars, slot.position.x, slot.position.y - 58);
  }
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
  command,
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
  const lastCommandRef = useRef(0);
  const [dragging, setDragging] = useState<{
    defenderId: number;
    point: Point;
  } | null>(null);
  const draggingRef = useRef(dragging);

  useEffect(() => {
    draggingRef.current = dragging;
  }, [dragging]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    snapshotRef.current = onSnapshot;
  }, [onSnapshot]);

  useEffect(() => {
    if (!command || command.sequence <= lastCommandRef.current) return;
    lastCommandRef.current = command.sequence;
    battleRef.current = commandBattle(battleRef.current, command);
    snapshotRef.current(battleRef.current);
  }, [command]);

  const logicalPoint = (event: React.PointerEvent<HTMLDivElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) / bounds.width * LOGICAL_WIDTH,
      y: (event.clientY - bounds.top) / bounds.height * LOGICAL_HEIGHT,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pausedRef.current || battleRef.current.status !== "active") return;
    const point = logicalPoint(event);
    const hero = battleRef.current.defenders
      .filter((defender) => defender.kind === "hero" && defender.slotIndex !== null)
      .map((defender) => ({
        defender,
        slot: battleRef.current.config.towerSlots.find(
          (slot) => slot.index === defender.slotIndex,
        ),
      }))
      .filter((entry) => entry.slot)
      .sort((left, right) => (
        Math.hypot(point.x - left.slot!.position.x, point.y - left.slot!.position.y)
        - Math.hypot(point.x - right.slot!.position.x, point.y - right.slot!.position.y)
      ))[0];
    if (hero && Math.hypot(
      point.x - hero.slot!.position.x,
      point.y - hero.slot!.position.y,
    ) <= 60) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging({ defenderId: hero.defender.id, point });
      return;
    }
    battleRef.current = moveLord(
      battleRef.current,
      closestPathPoint(battleRef.current.config.path, point),
    );
    snapshotRef.current(battleRef.current);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging({ ...dragging, point: logicalPoint(event) });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const point = logicalPoint(event);
    const target = battleRef.current.config.towerSlots
      .filter((slot) => slot.state === "deployable")
      .map((slot) => ({
        slot,
        distance: Math.hypot(point.x - slot.position.x, point.y - slot.position.y),
      }))
      .sort((left, right) => left.distance - right.distance)[0];
    if (target && target.distance <= 74) {
      battleRef.current = moveOrMergeDefender(
        battleRef.current,
        dragging.defenderId,
        target.slot.index,
      );
      snapshotRef.current(battleRef.current);
    }
    setDragging(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    battleRef.current = initialBattle;
    lastCommandRef.current = 0;
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
    let loadedAssets: FrontlineSpineAsset[] = [];
    const renderer = new SceneRenderer(canvas, gl, true);
    renderer.camera.setViewport(LOGICAL_WIDTH, LOGICAL_HEIGHT);
    renderer.camera.position.set(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, 0);

    const loadActors = async () => {
      const loadedEntries = await Promise.all(
        Object.keys(FRONTLINE_ACTOR_DIRECTORIES).map(async (actorId) => [
          actorId,
          await loadFrontlineSpineActor(gl, actorId),
        ] as const),
      );
      return new Map(loadedEntries);
    };

    const render = (assets: Map<string, FrontlineSpineAsset>, now: number) => {
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
      const renderItems: Array<{
        key: string;
        actorId: string;
        point: Point;
        animation: ActorAnimation;
        directionX?: number;
      }> = [];
      for (const defender of battle.defenders) {
        const point = defender.kind === "lord"
          ? defender.position
          : battle.config.towerSlots.find(
            (candidate) => candidate.index === defender.slotIndex,
          )?.position;
        if (!point) continue;
        renderItems.push({
          key: `defender-${defender.id}`,
          actorId: defender.actorId,
          point,
          animation: defender.animation,
          directionX: defender.facingX,
        });
        if (draggingRef.current?.defenderId === defender.id) {
          renderItems.push({
            key: `dragging-${defender.id}`,
            actorId: defender.actorId,
            point: draggingRef.current.point,
            animation: "stand",
            directionX: defender.facingX,
          });
        }
      }
      for (const unit of battle.summonedUnits) {
        renderItems.push({
          key: `summon-${unit.id}`,
          actorId: unit.actorId,
          point: unit.position,
          animation: unit.animation,
          directionX: unit.facingX,
        });
      }
      for (const enemy of battle.enemies) {
        const direction = pathDirection(battle.config.path, enemy.distance);
        renderItems.push({
          key: `enemy-${enemy.id}`,
          actorId: enemy.actorId,
          point: pathPosition(battle.config.path, enemy.distance),
          animation: enemy.animation,
          directionX: direction.x,
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
          view = createActorView(asset, item.actorId);
          views.set(item.key, view);
        }
        setAnimation(view, item.animation);
        view.animationState.update(simulationSeconds);
        view.animationState.apply(view.skeleton);
        view.skeleton.update(simulationSeconds);
        placeActor(view, item.point, item.directionX);
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
        if (!active) {
          assets.forEach((asset) => asset.texture.dispose());
          return;
        }
        loadedAssets = [...assets.values()];
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
      loadedAssets.forEach((asset) => asset.texture.dispose());
      renderer.dispose();
    };
  }, [initialBattle, onError, onReady]);

  return (
    <div
      className={`battle-canvas${dragging ? " dragging" : ""}`}
      aria-label="第一关战场，可点击移动领主或拖动英雄"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setDragging(null)}
    >
      <canvas ref={canvasRef} width={1800} height={3200} />
      <canvas ref={overlayRef} width={900} height={1600} />
      {dragging && (
        <span
          className="battle-drag-target"
          aria-hidden="true"
          style={{
            left: `${dragging.point.x / 9}%`,
            top: `${dragging.point.y / 16}%`,
          }}
        />
      )}
    </div>
  );
}
