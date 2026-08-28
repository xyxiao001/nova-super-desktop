"use client";

import { Component, Suspense, type ErrorInfo, type ReactNode } from "react";

class AppChunkErrorBoundary extends Component<
  { appName: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Failed to load ${this.props.appName}`, error, info);
  }

  render() {
    if (this.state.failed) {
      return <section className="app-load-error" role="alert">
        <span>!</span>
        <strong>{this.props.appName}加载失败</strong>
        <button onClick={() => window.location.replace(window.location.href)}>重新加载桌面</button>
      </section>;
    }
    return this.props.children;
  }
}

export default function AppLoadBoundary({
  appName,
  children,
}: {
  appName: string;
  children: ReactNode;
}) {
  return <AppChunkErrorBoundary appName={appName}>
    <Suspense fallback={<section className="app-loading" role="status" aria-live="polite"><i/><strong>正在打开{appName}</strong></section>}>
      {children}
    </Suspense>
  </AppChunkErrorBoundary>;
}
