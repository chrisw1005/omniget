// Pure, rune-free logic for the LinkGrabber staging list. Kept separate from
// the `.svelte.ts` store so it can be unit-tested under the node Vitest env
// (which does not run the Svelte compiler, so `$state` is unavailable here).
import type { FormatInfo } from "$lib/types/formats";

export type LinkGrabberMode = "video" | "audio";
export type LinkGrabberStatus = "pending" | "fetching" | "ready" | "error";

export interface LinkGrabberAudio {
  embedThumbnail: boolean;
  embedMetadata: boolean;
  coverPath?: string | null;
  metaTitle?: string;
  metaArtist?: string;
  metaAlbum?: string;
}

export interface LinkGrabberItem {
  id: string;
  url: string;
  mode: LinkGrabberMode;
  status: LinkGrabberStatus;
  title?: string;
  author?: string;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  formats: FormatInfo[];
  formatError?: string;
  selectedQuality: string;
  selectedFormatId: string | null;
  audio?: LinkGrabberAudio;
  addedAt: number;
}

let idCounter = 0;

/** Generate a session-unique id. `now` is passed in so callers control time. */
export function makeId(now: number): string {
  idCounter += 1;
  return `lg_${now}_${idCounter}`;
}

/** Build a fresh pending item. Audio items also get a default embed config. */
export function createItem(
  url: string,
  mode: LinkGrabberMode,
  defaultQuality: string,
  now: number,
): LinkGrabberItem {
  const item: LinkGrabberItem = {
    id: makeId(now),
    url,
    mode,
    status: "pending",
    formats: [],
    selectedQuality: defaultQuality,
    selectedFormatId: null,
    addedAt: now,
  };
  if (mode === "audio") {
    item.audio = { embedThumbnail: true, embedMetadata: true, coverPath: null };
  }
  return item;
}

/** True when an item with the same URL is already staged. */
export function isDuplicate(items: LinkGrabberItem[], url: string): boolean {
  return items.some((i) => i.url === url);
}

export function serializeItems(items: LinkGrabberItem[]): string {
  return JSON.stringify(items);
}

/** Parse persisted items, tolerating corrupt or partial data. */
export function deserializeItems(raw: string): LinkGrabberItem[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x) =>
        x &&
        typeof x.url === "string" &&
        typeof x.id === "string" &&
        (x.mode === "video" || x.mode === "audio"),
    );
  } catch {
    return [];
  }
}
