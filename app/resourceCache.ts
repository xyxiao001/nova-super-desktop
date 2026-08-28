"use client";

import { RESOURCE_PACKAGE_MANIFESTS } from "./appManifest";

export type NovaResourcePackage = {
  id: string;
  label: string;
  description: string;
  cacheName: string;
  entries: number;
  bytes: number;
};

const RESOURCE_PACKAGE_CATALOG: Array<Pick<NovaResourcePackage, "id" | "label" | "description">> = [...RESOURCE_PACKAGE_MANIFESTS]
  .sort((left, right) => left.displayOrder - right.displayOrder)
  .map(({ id, label, description }) => ({ id, label, description }));

type ResourceCacheStats = Pick<NovaResourcePackage, "id" | "cacheName" | "entries" | "bytes">;

type ResourceCacheResponse =
  | { ok: true; packages?: ResourceCacheStats[] }
  | { ok: false; error: string };

const mergeResourceStats = (stats: ResourceCacheStats[] = []): NovaResourcePackage[] => {
  const statsById = new Map(stats.map((item) => [item.id, item]));
  return RESOURCE_PACKAGE_CATALOG.map((item) => ({
    ...item,
    cacheName: statsById.get(item.id)?.cacheName ?? "",
    entries: statsById.get(item.id)?.entries ?? 0,
    bytes: statsById.get(item.id)?.bytes ?? 0,
  }));
};

const requestServiceWorker = async (
  message: { type: "GET_RESOURCE_CACHE_STATUS" } | { type: "CLEAR_RESOURCE_CACHE"; packageId: string },
) => {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const worker = registration?.waiting
    ?? navigator.serviceWorker.controller
    ?? registration?.active;
  if (!worker) return null;

  return new Promise<ResourceCacheResponse>((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => reject(new Error("Service Worker 响应超时")), 4000);
    channel.port1.onmessage = (event: MessageEvent<ResourceCacheResponse>) => {
      window.clearTimeout(timeout);
      resolve(event.data);
    };
    worker.postMessage(message, [channel.port2]);
  });
};

export async function inspectResourceCaches(): Promise<NovaResourcePackage[]> {
  const response = await requestServiceWorker({ type: "GET_RESOURCE_CACHE_STATUS" });
  if (!response) return mergeResourceStats();
  if (!response.ok) throw new Error(response.error);
  return mergeResourceStats(response.packages);
}

export async function clearResourceCache(packageId: string) {
  const response = await requestServiceWorker({
    type: "CLEAR_RESOURCE_CACHE",
    packageId,
  });
  if (!response) throw new Error("Service Worker 尚未接管页面");
  if (!response.ok) throw new Error(response.error);
}
