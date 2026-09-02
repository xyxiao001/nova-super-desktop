"use client";

import { WindowInstanceProvider } from "../windows/WindowRuntime";
import WindowFrame, { type WindowFrameProps } from "../../shell/WindowFrame";
import {
  APP_COMPONENTS,
  APP_REGISTRY,
} from "./appRegistry";
import type { WindowInstance } from "../windows/windowInstanceState";

type AppHostProps = Omit<WindowFrameProps, "instanceId" | "app" | "title" | "icon" | "children"> & {
  instance: WindowInstance;
  title?: string;
};

export default function AppHost({ instance, title, ...windowProps }: AppHostProps) {
  const { app, id } = instance;
  const definition = APP_REGISTRY[app];
  const AppComponent = APP_COMPONENTS[app];

  return (
    <WindowInstanceProvider value={{ id, app, target: instance.target }}>
      <WindowFrame
        {...windowProps}
        instanceId={id}
        app={app}
        title={title ?? instance.title ?? definition.label}
        icon={definition.windowIcon ?? definition.icon}
      >
        <AppComponent />
      </WindowFrame>
    </WindowInstanceProvider>
  );
}
