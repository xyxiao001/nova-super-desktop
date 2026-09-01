"use client";

import { useWindowRuntime } from "../windows/WindowRuntime";
import WindowFrame, { type WindowFrameProps } from "../../shell/WindowFrame";
import {
  APP_COMPONENTS,
  APP_REGISTRY,
  type WindowAppId,
} from "./appRegistry";

type AppHostProps = Omit<WindowFrameProps, "app" | "title" | "icon" | "children"> & {
  app: WindowAppId;
  title?: string;
};

export default function AppHost({ app, title, ...windowProps }: AppHostProps) {
  const definition = APP_REGISTRY[app];
  const AppComponent = APP_COMPONENTS[app];
  const runtime = useWindowRuntime();

  return (
    <WindowFrame
      {...windowProps}
      app={app}
      title={title ?? runtime.windowTitles[app] ?? definition.label}
      icon={definition.windowIcon ?? definition.icon}
    >
      <AppComponent />
    </WindowFrame>
  );
}
