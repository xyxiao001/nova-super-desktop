"use client";

import { useEffect, useRef, useState } from "react";

export default function PwaManager() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const refreshingRef = useRef(false);

  useEffect(() => {
    const updateOnlineState = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);

    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") {
      return () => {
        window.removeEventListener("online", updateOnlineState);
        window.removeEventListener("offline", updateOnlineState);
      };
    }

    const handleControllerChange = () => {
      if (!refreshingRef.current) return;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    let registration: ServiceWorkerRegistration | null = null;
    const register = async () => {
      registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      if (registration.waiting) {
        if (navigator.serviceWorker.controller) setWaitingWorker(registration.waiting);
        else registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
      registration.addEventListener("updatefound", handleUpdateFound);
      if (registration.installing) handleUpdateFound();
    };
    const handleUpdateFound = () => {
      const worker = registration?.installing;
      if (!worker) return;
      const handleStateChange = () => {
        if (worker.state !== "installed") return;
        if (navigator.serviceWorker.controller) setWaitingWorker(worker);
        else worker.postMessage({ type: "SKIP_WAITING" });
      };
      worker.addEventListener("statechange", handleStateChange);
    };

    void register().catch((error) => console.error("NOVA service worker registration failed", error));
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      registration?.removeEventListener("updatefound", handleUpdateFound);
    };
  }, []);

  const applyUpdate = () => {
    if (!waitingWorker) return;
    refreshingRef.current = true;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  };

  if (online && !waitingWorker) return null;
  return <aside className={`pwa-status ${online ? "update" : "offline"}`} role="status">
    <span aria-hidden="true"/>
    <strong>{online ? "新版本已就绪" : "离线模式"}</strong>
    {online && <button onClick={applyUpdate}>立即更新</button>}
  </aside>;
}
