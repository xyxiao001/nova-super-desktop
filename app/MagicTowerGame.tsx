"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  finishGame,
  saveGameProgress,
  subscribeGameReset,
  touchGame,
} from "./gameStorage";
import {
  createMagicTowerCommand,
  MAGIC_TOWER_ENGINE,
  MAGIC_TOWER_FRAME_SRC,
  parseMagicTowerFrameMessage,
} from "./magicTowerBridge";

type FrameState = "loading" | "ready" | "error";

export default function MagicTowerGame({ active }: { active: boolean }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [frameState, setFrameState] = useState<FrameState>("loading");
  const [frameVersion, setFrameVersion] = useState(0);
  const [frameError, setFrameError] = useState("");

  const postCommand = useCallback((type: "activate" | "deactivate" | "handshake" | "new-game") => {
    frameRef.current?.contentWindow?.postMessage(
      createMagicTowerCommand(type),
      "*",
    );
  }, []);

  useEffect(() => {
    touchGame("tower");
    return subscribeGameReset("tower", () => postCommand("new-game"));
  }, [postCommand]);

  useEffect(() => {
    const receiveMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const message = parseMagicTowerFrameMessage(event.data);
      if (!message) return;
      if (message.type === "ready") {
        setFrameState("ready");
        setFrameError("");
        postCommand(active ? "activate" : "deactivate");
      } else if (message.type === "progress") {
        saveGameProgress("tower", message.progress);
      } else if (message.type === "finished") {
        finishGame("tower", message.result);
      } else {
        setFrameState("error");
        setFrameError(message.message);
      }
    };
    window.addEventListener("message", receiveMessage);
    return () => window.removeEventListener("message", receiveMessage);
  }, [active, postCommand]);

  useEffect(() => {
    postCommand(active ? "activate" : "deactivate");
  }, [active, postCommand]);

  useEffect(() => {
    if (frameState !== "loading") return;
    const timeout = window.setTimeout(() => {
      setFrameState("error");
      setFrameError("游戏资源载入超时");
    }, 60_000);
    return () => window.clearTimeout(timeout);
  }, [frameState, frameVersion]);

  const reloadFrame = () => {
    setFrameState("loading");
    setFrameError("");
    setFrameVersion((current) => current + 1);
  };

  return (
    <main className="magic-tower-host">
      <header className="magic-tower-hostbar">
        <div className="magic-tower-hostbrand">
          <span aria-hidden="true"><i/><i/><i/></span>
          <div>
            <strong>{MAGIC_TOWER_ENGINE.name}</strong>
            <small>HumanBreak · {MAGIC_TOWER_ENGINE.version}</small>
          </div>
        </div>
        <div className={`magic-tower-connection ${frameState}`}>
          <i aria-hidden="true"/>
          <span>{frameState === "ready" ? "桥接就绪" : frameState === "error" ? "载入失败" : "正在载入"}</span>
        </div>
        <button type="button" aria-label="重新载入魔塔" title="重新载入" onClick={reloadFrame}>↻</button>
      </header>
      <section className="magic-tower-frame-shell">
        <iframe
          key={frameVersion}
          ref={frameRef}
          src={MAGIC_TOWER_FRAME_SRC}
          title="魔塔游戏画面"
          sandbox="allow-scripts allow-same-origin allow-downloads"
          allow="fullscreen"
          allowFullScreen
          referrerPolicy="no-referrer"
          onLoad={() => {
            postCommand("handshake");
            postCommand(active ? "activate" : "deactivate");
          }}
          onError={() => setFrameState("error")}
        />
        {frameState === "loading" && (
          <div className="magic-tower-frame-loading" role="status">
            <span aria-hidden="true"><i/><i/><i/><i/></span>
            <strong>正在载入完整魔塔</strong>
          </div>
        )}
        {frameState === "error" && (
          <div className="magic-tower-frame-error" role="alert">
            <strong>魔塔载入失败</strong>
            <span>{frameError}</span>
            <button type="button" onClick={reloadFrame}>重新载入</button>
          </div>
        )}
      </section>
    </main>
  );
}
