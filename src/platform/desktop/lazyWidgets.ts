import { lazy } from "react";

export const WeatherDesktopCard = lazy(() => import("../../apps/weather/WeatherDesktopCard"));

export const RadioSession = lazy(() => import("../../apps/radio/RadioPlaybackHost"));

export const MusicPlaybackHost = lazy(() => import("../../apps/music/MusicPlaybackHost"));
