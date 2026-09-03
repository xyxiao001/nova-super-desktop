"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import {
  systemMomentDuration,
  type NovaSystemMoment,
} from "../../app/systemMoments";

type DesktopMomentLayerProps = {
  moment: NovaSystemMoment;
  onComplete: (id: string) => void;
};

const SPARKS = Array.from({ length: 12 }, (_, index) => index);

export default function DesktopMomentLayer({
  moment,
  onComplete,
}: DesktopMomentLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (moment.type !== "game-win") return;
    const layer = layerRef.current;
    const target = document.querySelector<HTMLElement>(
      `.desktop-window.${moment.source}-window`,
    );
    if (!layer || !target) return;
    const rect = target.getBoundingClientRect();
    layer.style.setProperty("--moment-left", `${rect.left}px`);
    layer.style.setProperty("--moment-top", `${rect.top}px`);
    layer.style.setProperty("--moment-width", `${rect.width}px`);
    layer.style.setProperty("--moment-height", `${rect.height}px`);
  }, [moment]);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = window.setTimeout(
      () => onComplete(moment.id),
      systemMomentDuration(moment.type, reducedMotion),
    );
    return () => window.clearTimeout(timer);
  }, [moment, onComplete]);

  return (
    <div
      ref={layerRef}
      className={`desktop-moment-layer moment-${moment.type}`}
      data-moment-id={moment.id}
      data-moment-source={moment.source}
      aria-hidden="true"
    >
      {moment.type === "creative-save" && (
        <div className="moment-edge-sparks">
          {SPARKS.map((index) => <i key={index} />)}
        </div>
      )}
      {moment.type === "focus-complete" && (
        <div className="moment-focus-rings"><i /><i /><i /></div>
      )}
      {moment.type === "game-win" && (
        <div className="moment-game-frame">
          {SPARKS.map((index) => <i key={index} />)}
        </div>
      )}
    </div>
  );
}
