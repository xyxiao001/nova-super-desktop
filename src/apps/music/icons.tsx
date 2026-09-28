import type { CSSProperties } from "react";
const paths = {
  chart: "M4 3v18h17M8 16v-4M13 16V7M18 16v-7",
  music:
    "M9 18V5l11-2v13M9 8l11-2M9 18c0 2-6 4-6 1s6-4 6-1zm11-2c0 2-6 4-6 1s6-4 6-1z",
  play: "m8 5 11 7-11 7Z",
  pause: "M8 5v14M16 5v14",
  next: "m4 5 11 7-11 7ZM19 5v14",
  previous: "m20 5-11 7 11 7ZM5 5v14",
  search: "M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  heart: "M12 20S2 14 2 7a5 5 0 0 1 10-2 5 5 0 0 1 10 2c0 7-10 13-10 13Z",
  download: "M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4",
  upload: "M12 16V3m-5 5 5-5 5 5M4 17v4h16v-4",
  plus: "M12 4v16M4 12h16",
  lyrics: "M4 4h16v13H9l-5 4ZM8 8h8M8 12h5",
  queue: "M4 5h16M4 11h16M4 17h10m3-2 4 3-4 3",
  volume: "M11 4 6 8H2v8h4l5 4ZM15 8q4 4 0 8m3-11q7 7 0 14",
  poster: "M4 2h16v20H4ZM7 6h10M7 10h10M7 14h5",
  close: "m6 6 12 12M6 18 18 6",
  repeat: "m17 2 4 4-4 4M3 11V6h18M7 22l-4-4 4-4m14-3v7H3",
  shuffle:
    "M3 5h3c5 0 7 14 12 14h3m-4-4 4 4-4 4M3 19h3c5 0 7-14 12-14h3m-4-4 4 4-4 4",
  window: "M3 4h18v16H3ZM3 8h18",
  edit: "m4 16 12-12 4 4L8 20H4Zm10-10 4 4",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7",
  album:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0m-6 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  lock: "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5Z",
  check: "m4 12 5 5L20 6",
  sun: "M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
} as const;
export type IconName = keyof typeof paths;
export function Icon({
  name,
  size = 20,
  style,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
