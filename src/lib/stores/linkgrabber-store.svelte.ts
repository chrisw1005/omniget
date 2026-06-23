// LinkGrabber staging-list store. The reactive `$state` array lives here; all
// rune-free logic lives in `linkgrabber-logic.ts` (unit-tested separately).
import { invoke } from "@tauri-apps/api/core";
import type { FormatInfo } from "$lib/types/formats";
import {
  createItem,
  isDuplicate,
  serializeItems,
  deserializeItems,
  type LinkGrabberItem,
  type LinkGrabberMode,
} from "./linkgrabber-logic";

export type {
  LinkGrabberItem,
  LinkGrabberMode,
  LinkGrabberStatus,
  LinkGrabberAudio,
} from "./linkgrabber-logic";

const STORAGE_KEY = "omniget_linkgrabber";

function hydrate(): LinkGrabberItem[] {
  if (typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? deserializeItems(raw) : [];
}

let items = $state<LinkGrabberItem[]>(hydrate());

/** Persist the current list. Exported so rows can save after two-way bindings
 * (e.g. QualityPicker) mutate an item in place. */
export function persist() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, serializeItems(items));
}

export function getItems(): LinkGrabberItem[] {
  return items;
}

/** Stage a URL. Returns the new item, or null if the URL is already staged. */
export function addItem(
  url: string,
  mode: LinkGrabberMode,
  defaultQuality = "best",
): LinkGrabberItem | null {
  if (isDuplicate(items, url)) return null;
  const item = createItem(url, mode, defaultQuality, Date.now());
  items.push(item);
  persist();
  return item;
}

export function removeItem(id: string): void {
  const idx = items.findIndex((i) => i.id === id);
  if (idx >= 0) {
    items.splice(idx, 1);
    persist();
  }
}

export function updateItem(id: string, patch: Partial<LinkGrabberItem>): void {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  Object.assign(item, patch);
  persist();
}

export function clearAll(): void {
  items.splice(0, items.length);
  persist();
}

/** Apply a media-info preview (routed from the `media-info-preview` event) to
 * whichever staged item has this URL. Enriches title/thumbnail/duration. */
export function applyPreview(
  url: string,
  preview: {
    title?: string;
    author?: string;
    thumbnail_url?: string | null;
    duration_seconds?: number | null;
  },
): void {
  const item = items.find((i) => i.url === url);
  if (!item) return;
  updateItem(item.id, {
    title: preview.title ?? item.title,
    author: preview.author ?? item.author,
    thumbnailUrl: preview.thumbnail_url ?? item.thumbnailUrl ?? null,
    durationSeconds: preview.duration_seconds ?? item.durationSeconds ?? null,
  });
}

// --- per-item fetch with a small concurrency cap ---------------------------
const MAX_CONCURRENT_FETCH = 3;
let inFlight = 0;
const fetchQueue: string[] = [];

/** Queue an item for media-info + format fetching (respects the cap). */
export function enqueueFetch(id: string): void {
  if (!fetchQueue.includes(id)) fetchQueue.push(id);
  pumpFetch();
}

function pumpFetch(): void {
  while (inFlight < MAX_CONCURRENT_FETCH && fetchQueue.length > 0) {
    const id = fetchQueue.shift() as string;
    inFlight += 1;
    void fetchItem(id).finally(() => {
      inFlight -= 1;
      pumpFetch();
    });
  }
}

async function fetchItem(id: string): Promise<void> {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  updateItem(id, { status: "fetching", formatError: undefined });
  // Fire-and-forget preview; it arrives via the `media-info-preview` event and
  // is routed back here through applyPreview() by the download listener.
  void invoke("prefetch_media_info", { url: item.url }).catch(() => {});
  try {
    const formats = await invoke<FormatInfo[]>("get_media_formats", {
      url: item.url,
    });
    updateItem(id, { formats, status: "ready" });
  } catch (e) {
    updateItem(id, { status: "error", formatError: String(e) });
  }
}
