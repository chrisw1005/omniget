// LinkGrabber staging-list store. The reactive `$state` array lives here; all
// rune-free logic lives in `linkgrabber-logic.ts` (unit-tested separately).
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

function persist() {
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
