import type { WindowAppId } from "./appManifest";

export function appShareUrl(app: WindowAppId, origin: string) {
  return new URL(`/?app=${app}`, origin).href;
}

export async function copyShareLink(url: string): Promise<"copied" | "manual"> {
  if (!navigator.clipboard) return "manual";
  await navigator.clipboard.writeText(url);
  return "copied";
}
