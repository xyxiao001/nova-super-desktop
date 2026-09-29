import { useEffect, useRef } from "react";
import * as THREE from "three";
import { concertLevels } from "./ConcertStage";
import { createPlaceWorld, disposePlaceWorld } from "./placeWorlds";
import type { StageView } from "./performance";

export default function PlaceCanvas({ view, cover, analyser, playing }: {
  view: StageView; cover: string; analyser: AnalyserNode | null; playing: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const latest = useRef({ view, analyser, playing });
  latest.current = { view, analyser, playing };
  const refresh = useRef<() => void>(() => {});
  useEffect(() => {
    const host = root.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);
    let disposed = false, frame = 0, clock = 0, previous = 0, visible = false;
    let width = 0, height = 0;
    let bins = new Uint8Array(0);
    const world = createPlaceWorld(view.scene as Exclude<StageView["scene"], "concert">, cover, () => { if (!disposed) draw(); });
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    function draw() {
      if (!width || !height) return;
      const state = latest.current;
      let bass = 0, air = 0;
      if (state.playing && state.analyser && !motion.matches) {
        if (bins.length !== state.analyser.frequencyBinCount) bins = new Uint8Array(state.analyser.frequencyBinCount);
        state.analyser.getByteFrequencyData(bins);
        ({ bass, air } = concertLevels(bins, state.analyser.context.sampleRate, state.analyser.fftSize));
      }
      world.resize(width / height, state.view.camera);
      world.update(clock, bass, air, state.view.palette);
      renderer.render(world.scene, world.camera);
    }
    function tick(now: number) {
      if (previous) clock += (now - previous) / 1000;
      previous = now;draw();frame = requestAnimationFrame(tick);
    }
    function update() {
      cancelAnimationFrame(frame);previous = 0;
      if (!visible || document.hidden) return;
      draw();
      if (latest.current.playing && !motion.matches) frame = requestAnimationFrame(tick);
    }
    const resize = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width;height = entry.contentRect.height;
      renderer.setSize(width, height, false);update();
    });
    const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting;update(); });
    resize.observe(host);visibility.observe(host);
    motion.addEventListener("change", update);document.addEventListener("visibilitychange", update);
    refresh.current = update;
    return () => {
      disposed = true;cancelAnimationFrame(frame);resize.disconnect();visibility.disconnect();
      motion.removeEventListener("change", update);document.removeEventListener("visibilitychange", update);
      refresh.current = () => {};disposePlaceWorld(world.scene);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
    };
  }, [view.scene, cover]);
  useEffect(() => { refresh.current(); }, [view.camera, view.palette, playing, analyser]);
  return <div className="nm-place-canvas" ref={root} aria-hidden="true" />;
}
