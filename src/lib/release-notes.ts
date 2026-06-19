// Bundled release notes for this fork, keyed by version then language.
// Shown in the About → Changelog tab and the update dialog without a network
// call. Markdown is rendered by the lightweight renderer in
// src/routes/about/changelog/+page.svelte (## / ### headings, - lists, **bold**,
// `code`, and [links](url)). Falls back to English when a locale is missing.

type Notes = Record<string, string>; // language code -> markdown

export const RELEASE_NOTES: Record<string, Notes> = {
  "0.8.0": {
    en: `## OmniGet 0.8.0

First release of the [chrisw1005](https://github.com/chrisw1005/omniget) fork, built on top of [tonhowtf/omniget](https://github.com/tonhowtf/omniget).

### Redesigned converter
- Drag and drop **multiple files** at once, each with its own collapsible settings.
- Video **thumbnails** and full metadata: resolution, fps, codecs, channels, size, bitrate.
- **Quality vs file size** control — target a quality level (CRF / VideoToolbox) or a bitrate.
- **Hardware acceleration** toggle (\`h264_videotoolbox\` / \`hevc_videotoolbox\`) with a separate encoding-speed option.
- Live output-size estimate and **real transcode progress** with speed and ETA.
- Editable output filename, re-convert, and per-row selection.
- The convert backend now runs in the core app instead of a separate plugin.

### Traditional Chinese
- Full **繁體中文** localization with Taiwan terminology, plus a dedicated \`zh-TW\` language option.

### Look and feel
- The macOS shell now uses the **brand orange** accent instead of the system blue.
- Redesigned **About** page with fork details, plus refreshed project and changelog tabs.`,

    "zh-TW": `## OmniGet 0.8.0

[chrisw1005](https://github.com/chrisw1005/omniget) Fork 的首個版本,基於 [tonhowtf/omniget](https://github.com/tonhowtf/omniget) 開發。

### 轉換功能重新設計
- 可一次拖曳**多個檔案**,每個檔案各有獨立的折疊設定。
- 顯示影片**縮圖**與完整 metadata:解析度、fps、編碼、聲道、大小、位元率。
- **依畫質 / 依檔案大小**控制 — 指定畫質(CRF / VideoToolbox)或位元率。
- **硬體加速**開關(\`h264_videotoolbox\` / \`hevc_videotoolbox\`),並有獨立的編碼速度選項。
- 即時預估輸出大小,以及**真實轉檔進度**(含速度與剩餘時間)。
- 可編輯輸出檔名、重新轉檔、逐檔勾選。
- 轉檔後端改為內建於主程式,不再需要獨立外掛。

### 繁體中文
- 完整**繁體中文**在地化(台灣用語),並新增專屬的 \`zh-TW\` 語言選項。

### 外觀
- macOS 外殼改用**品牌橘色**主色,取代系統藍。
- 重新設計**關於**頁(含 Fork 資訊),並更新專案與更新紀錄分頁。`,
  },
};

export function localReleaseNotes(version: string, lang = "en"): string {
  const notes = RELEASE_NOTES[version];
  if (!notes) return "";
  return notes[lang] ?? notes["en"] ?? "";
}
