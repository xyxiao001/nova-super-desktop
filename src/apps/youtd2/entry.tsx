"use client";

import "./youtd2.css";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ResourceLoadProgress,
  resourceLoadPercent,
} from "../../platform/resources/ResourceLoadProgress";
import { useWindowRuntime } from "../../platform/windows/WindowRuntime";
import { touchGame } from "../games/shared/gameStorage";
import {
  createYouTd2Command,
  parseYouTd2FrameMessage,
  YOUTD2_ENGINE,
  YOUTD2_FRAME_SRC,
} from "./youtd2Bridge";

type FrameState = "loading" | "ready" | "error";
type LoadPhase = "downloading" | "initializing";
type LoadProgress = { loaded: number; total: number };

export default function YouTd2Game() {
  const active = useWindowRuntime().isAppActive("youtd2");
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [frameState, setFrameState] = useState<FrameState>("loading");
  const [frameVersion, setFrameVersion] = useState(0);
  const [frameError, setFrameError] = useState("");
  const [loadPhase, setLoadPhase] = useState<LoadPhase>("downloading");
  const [loadProgress, setLoadProgress] = useState<LoadProgress | null>(null);
  const loadPercent = resourceLoadPercent(loadProgress?.loaded, loadProgress?.total);

  const postCommand = useCallback((type: "activate" | "deactivate" | "handshake") => {
    frameRef.current?.contentWindow?.postMessage(createYouTd2Command(type), "*");
  }, []);

  useEffect(() => {
    touchGame("youtd2");
  }, []);

  useEffect(() => {
    const receiveMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const message = parseYouTd2FrameMessage(event.data);
      if (!message) return;
      if (message.type === "ready") {
        setFrameState("ready");
        setFrameError("");
        postCommand(active ? "activate" : "deactivate");
      } else if (message.type === "error") {
        setFrameState("error");
        setFrameError(message.message);
      } else if (message.type === "progress") {
        setLoadPhase("downloading");
        setLoadProgress({ loaded: message.loaded, total: message.total });
      } else {
        setLoadPhase("initializing");
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
    }, 120_000);
    return () => window.clearTimeout(timeout);
  }, [frameState, frameVersion]);

  const reloadFrame = () => {
    setFrameState("loading");
    setFrameError("");
    setLoadPhase("downloading");
    setLoadProgress(null);
    setFrameVersion((current) => current + 1);
  };

  return (
    <main className="youtd2-host">
      <header className="youtd2-hostbar">
        <div className="youtd2-hostbrand">
          <span aria-hidden="true"><i/><i/><i/></span>
          <div>
            <strong>{YOUTD2_ENGINE.name}</strong>
            <small>Icob Games · {YOUTD2_ENGINE.version}</small>
          </div>
        </div>
        <div className={`youtd2-connection ${frameState}`}>
          <i aria-hidden="true"/>
          <span>
            {frameState === "ready"
              ? "游戏就绪"
              : frameState === "error"
                ? "载入失败"
                : loadPhase === "initializing"
                  ? "正在初始化"
                  : `正在下载${loadPercent === null ? "" : ` ${loadPercent}%`}`}
          </span>
        </div>
        <button type="button" aria-label="重新载入 YouTD 2" title="重新载入" onClick={reloadFrame}>↻</button>
      </header>
      <section className="youtd2-frame-shell">
        <iframe
          key={frameVersion}
          ref={frameRef}
          src={YOUTD2_FRAME_SRC}
          title="YouTD 2 游戏画面"
          sandbox="allow-scripts allow-same-origin allow-downloads allow-pointer-lock"
          allow="autoplay; fullscreen; gamepad; cross-origin-isolated"
          allowFullScreen
          referrerPolicy="no-referrer"
          onLoad={() => {
            postCommand("handshake");
            postCommand(active ? "activate" : "deactivate");
          }}
          onError={() => {
            setFrameState("error");
            setFrameError("游戏页面载入失败");
          }}
        />
        {frameState === "loading" && (
          <div className="youtd2-frame-loading" role="status">
            <span aria-hidden="true"><i/><i/><i/></span>
            <ResourceLoadProgress
              label={loadPhase === "initializing" ? "正在初始化引擎" : "正在下载游戏资源"}
              detail={loadPhase === "initializing" ? "资源就绪，正在启动游戏" : "正在接收核心游戏包"}
              loadedBytes={loadProgress?.loaded}
              totalBytes={loadProgress?.total}
              indeterminate={loadPhase === "initializing" || !loadProgress}
              indeterminateLabel={loadPhase === "initializing" ? "处理中" : "连接中"}
            />
          </div>
        )}
        {frameState === "error" && (
          <div className="youtd2-frame-error" role="alert">
            <strong>YouTD 2 载入失败</strong>
            <span>{frameError}</span>
            <button type="button" onClick={reloadFrame}>重新载入</button>
          </div>
        )}
      </section>
    </main>
  );
}
