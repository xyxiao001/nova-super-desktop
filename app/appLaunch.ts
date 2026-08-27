export type AppLaunchTarget =
  | { app: "reader"; kind: "book"; bookId: string }
  | { app: "settings"; kind: "section"; sectionId: string }
  | { app: "explorer"; kind: "file"; itemId: string; parentId: string | null };

export type AppLaunchIntent = AppLaunchTarget & {
  requestId: number;
};

export function createAppLaunchIntent(
  requestId: number,
  target: AppLaunchTarget,
): AppLaunchIntent {
  return { ...target, requestId };
}

export function launchIntentFor<TApp extends AppLaunchTarget["app"]>(
  intent: AppLaunchIntent | null,
  app: TApp,
): Extract<AppLaunchIntent, { app: TApp }> | null {
  return intent?.app === app
    ? intent as Extract<AppLaunchIntent, { app: TApp }>
    : null;
}
