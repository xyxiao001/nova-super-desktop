"use client";

import type { CSSProperties } from "react";
import "./resourceLoadProgress.css";

type ResourceLoadProgressProps = {
  label: string;
  detail?: string;
  loadedBytes?: number;
  totalBytes?: number;
  indeterminate?: boolean;
  indeterminateLabel?: string;
};

export function formatResourceBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** unitIndex;
  return `${unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

export function resourceLoadPercent(loadedBytes?: number, totalBytes?: number) {
  if (
    loadedBytes === undefined
    || totalBytes === undefined
    || !Number.isFinite(loadedBytes)
    || !Number.isFinite(totalBytes)
    || totalBytes <= 0
  ) {
    return null;
  }
  return Math.round(Math.min(1, Math.max(0, loadedBytes / totalBytes)) * 100);
}

export function ResourceLoadProgress({
  label,
  detail,
  loadedBytes,
  totalBytes,
  indeterminate = false,
  indeterminateLabel = "准备中",
}: ResourceLoadProgressProps) {
  const percent = indeterminate ? null : resourceLoadPercent(loadedBytes, totalBytes);
  const byteLabel = loadedBytes !== undefined && totalBytes !== undefined && totalBytes > 0
    ? `${formatResourceBytes(loadedBytes)} / ${formatResourceBytes(totalBytes)}`
    : null;

  return (
    <div className={`resource-load-progress ${percent === null ? "indeterminate" : ""}`}>
      <div className="resource-load-heading">
        <strong>{label}</strong>
        <output>{percent === null ? indeterminateLabel : `${percent}%`}</output>
      </div>
      <div
        className="resource-load-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-valuetext={percent === null ? detail ?? label : `${percent}%，${byteLabel}`}
      >
        <i style={{ "--resource-load-percent": `${percent ?? 28}%` } as CSSProperties} />
      </div>
      <div className="resource-load-meta">
        <span>{detail}</span>
        {byteLabel && <span>{byteLabel}</span>}
      </div>
    </div>
  );
}
