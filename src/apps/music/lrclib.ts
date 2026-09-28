export type LrclibResult = {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  syncedLyrics: string | null;
  plainLyrics: string | null;
};

export async function searchLrclib(
  query: string,
  signal: AbortSignal,
): Promise<LrclibResult[]> {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`https://lrclib.net/api/search?${params}`, {
    signal,
  });
  if (!response.ok) throw new Error(`LRCLIB 请求失败 (${response.status})`);
  return response.json();
}
