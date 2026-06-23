// Bundled release notes for this fork, keyed by version then language.
// Shown in the About → Changelog tab and the update dialog without a network
// call. Markdown is rendered by the lightweight renderer in
// src/routes/about/changelog/+page.svelte (## / ### headings, - lists, **bold**,
// `code`, and [links](url)). Falls back to English when a locale is missing.

type Notes = Record<string, string>; // language code -> markdown

export const RELEASE_NOTES: Record<string, Notes> = {
  "0.9.0": {
    en: `## OmniGet 0.9.0

### Link Grabber — a download staging list
A new **Link Grabber** page. The global hotkeys (\`CmdOrCtrl+Shift+D\` for video, \`CmdOrCtrl+Shift+M\` for audio) and a paste field now send links to a staging list where you tune each one before downloading — instead of downloading immediately with the defaults.

- **Collapsible rows**, each with its own quality / format (video) or format / bitrate (audio).
- **Inline-edit** the title, author and album — just click the text. The edited title becomes the **output filename** (no \`[id]\` suffix).
- **Audio covers**: embed the thumbnail or **upload your own**, pick a **square or original** shape, and the row preview matches the result.
- The list **persists across restarts**, and links are checked against a supported site before they're added.

### Other improvements
- Hotkey settings are now **record-only** (removed the confusing manual "type" mode).
- The **Downloads** page scrolls correctly again.`,

    "zh-TW": `## OmniGet 0.9.0

### 待下載清單(Link Grabber)
新增**待下載**頁。全域快捷鍵(\`CmdOrCtrl+Shift+D\` 影片、\`CmdOrCtrl+Shift+M\` 音訊)與貼上欄位現在會把連結送進待下載清單,讓你逐項調整後再下載 —— 不再直接用預設值下載。

- **可折疊的項目**,每筆各自設定畫質 / 格式(影片)或格式 / 位元率(音訊)。
- **點擊即可編輯**標題、作者、專輯;編輯後的標題會直接成為**輸出檔名**(不再有 \`[id]\` 亂碼)。
- **音訊封面**:可嵌入縮圖或**上傳自訂封面**,選擇**正方形或原始**形狀,列上預覽即所見即所得。
- 清單**跨重啟保留**,加入前會驗證是否為支援的連結。

### 其他改進
- 快捷鍵設定改為**只用錄製**(移除容易混淆的手動輸入模式)。
- 修正**下載**頁無法滾動的問題。`,
  },

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
