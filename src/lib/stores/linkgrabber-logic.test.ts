import { describe, it, expect } from "vitest";
import {
  createItem,
  isDuplicate,
  serializeItems,
  deserializeItems,
} from "./linkgrabber-logic";

describe("linkgrabber-logic", () => {
  it("creates a pending video item with defaults", () => {
    const item = createItem("https://x.com/a", "video", "best", 1000);
    expect(item.status).toBe("pending");
    expect(item.mode).toBe("video");
    expect(item.selectedQuality).toBe("best");
    expect(item.selectedFormatId).toBeNull();
    expect(item.formats).toEqual([]);
    expect(item.audio).toBeUndefined();
  });

  it("gives audio items a default embed config", () => {
    const item = createItem("https://x.com/a", "audio", "best", 1000);
    expect(item.audio).toBeTruthy();
    expect(item.audio?.embedThumbnail).toBe(true);
    expect(item.audio?.embedMetadata).toBe(true);
  });

  it("detects duplicates by url", () => {
    const items = [createItem("https://x.com/a", "video", "best", 1)];
    expect(isDuplicate(items, "https://x.com/a")).toBe(true);
    expect(isDuplicate(items, "https://x.com/b")).toBe(false);
  });

  it("round-trips serialize/deserialize", () => {
    const items = [
      createItem("https://x.com/a", "video", "best", 1),
      createItem("https://x.com/b", "audio", "1080p", 2),
    ];
    const back = deserializeItems(serializeItems(items));
    expect(back).toHaveLength(2);
    expect(back[0].url).toBe("https://x.com/a");
    expect(back[1].mode).toBe("audio");
  });

  it("tolerates corrupt or partial persisted data", () => {
    expect(deserializeItems("not json")).toEqual([]);
    expect(deserializeItems("{}")).toEqual([]);
    expect(deserializeItems('[{"foo":1}]')).toEqual([]);
  });
});
