# LinkGrabber「待下載」清單 — 設計規格

- 日期：2026-06-20
- 狀態：已核准設計，待實作計畫
- 範圍：單一交付（一個 PR），內含 A1 + toast 文案調整 + LinkGrabber Phase 1 + Phase 2

## 1. 目標與背景

目前透過全域快捷鍵（⌘⇧D 影片 / ⌘⇧M 音樂）下載時，後端直接呼叫 `external_url::queue_url_with_defaults`，**完全繞過**主下載頁既有的格式 / 畫質 / 模式選擇器，只能套用設定裡的預設值。使用者要的是 JDownloader 的 **LinkGrabber（待抓取暫存區）** 體驗：

> 複製網址 → 按 ⌘⇧D/⌘⇧M（保留手動流程以區分影 / 音）→ 先進「待下載清單」→ 逐項調整畫質 / 格式（音樂另可設封面與 metadata）→ 再正式開始下載。

## 2. 範圍

**本次交付（一起）**

- **A1**：移除快捷鍵設定的「類型（手動輸入）」模式，只留「錄製」。
- **Toast 文案**：既有的 `hotkey-download-queued` 提示，因行為改變，文案改為「已加入待下載清單」（listener / 系統通知 infra 沿用）。
- **LinkGrabber Phase 1（核心）**：新 `/linkgrabber` 頁 + 側欄 nav；持久化清單（跨重啟保留）；快捷鍵改為「加入清單」而非直接下載；頁面可手動貼網址加入；逐列重用既有 omnibox 元件做影 / 音、畫質、格式選擇（預帶設定預設值，可改）；逐筆 / 批次「開始下載」→ 進真正下載佇列 → 從清單移除。
- **LinkGrabber Phase 2（音樂封面 / metadata）**：擴充後端 `download_from_url` 接受逐筆覆寫；音樂列可開關嵌入封面、**上傳自訂封面**、編輯 metadata（標題 / 演出者 / 專輯）。

**非目標（明確不做）**

- 背景全域剪貼簿自動偵測（使用者已否決，維持手動快捷鍵）。
- 主輸入框（omnibox）行為不變，維持「貼上即可直接下載」。
- 觸發範圍僅限「可辨識影音平台」（registry `can_handle` 命中），不是任何 http(s) 連結都抓。

## 3. UX / 行為規格

### 3.1 進入 LinkGrabber 的方式

1. **快捷鍵**：⌘⇧D（預設影片）、⌘⇧M（預設音訊）讀當下剪貼簿。後端先以 `PlatformRegistry::find_platform(url)` 驗證為可辨識平台；命中才 `emit("linkgrabber-add", { url, mode })`，否則發提示 toast「不是支援的連結」。
2. **頁面手動貼網址**：LinkGrabber 頁上方有輸入框，可貼網址 + 選預設模式（影 / 音）加入。

### 3.2 清單項目生命週期（discriminated union: status）

`pending → fetching → ready → error`，以及送出後 `queued`（隨即從清單移除）。

- 加入時 status=`pending`，立即非同步抓 `prefetch`/preview 與 `get_media_formats`。
- 抓取中 status=`fetching`（顯示骨架）。
- 完成 status=`ready`：顯示縮圖 / 標題 / 時長 + 模式、畫質、格式選擇器（預帶設定預設值）。
- 失敗 status=`error`：顯示原因 + 重試鈕。

### 3.3 影片 vs 音訊

- 由加入時的 mode 決定預設（D=影片、M=音訊），列上仍可用 `DownloadModeSelector` 改。
- 音訊列額外顯示「音樂 metadata / 封面」面板（見 3.4）。

### 3.4 音樂封面 / metadata（Phase 2）

音訊列面板：

- 「嵌入封面」開關（預設取自 `settings.download.embed_thumbnail`），來源預設為影片縮圖。
- 「上傳自訂封面」：開檔挑圖（tauri dialog），存其路徑；有自訂封面時優先於縮圖。
- 「嵌入 metadata」開關（預設取自 `settings.download.embed_metadata`）。
- 可編輯欄位：標題 / 演出者 / 專輯（預帶抓到的 title / author，可改）。

### 3.5 開始下載

- 每列「開始下載」鈕；頁面頂部「全部開始」批次鈕。
- 呼叫 `download_from_url`，帶該列選定的 url / output_dir / download_mode / quality / format_id，及（音訊）`embed_thumbnail / embed_metadata / cover_path / meta_title / meta_artist / meta_album`。
- 成功 → 從 LinkGrabber 清單移除（已進真正下載佇列，於下載頁顯示）。

### 3.6 持久化

- 清單跨 App 重啟保留。Phase 1 以 webview `localStorage`（與 `changelog-store` 一致）持久化序列化後的項目（含已抓到的 title/thumbnail/formats/選擇值/status）。
- 自訂封面圖（Phase 2）複製到 app data dir 下 `linkgrabber-covers/`，項目存其路徑。

### 3.7 A1：快捷鍵設定簡化

- `ClipboardHotkeysSection.svelte`：移除「錄製 / 類型」切換與「類型」文字輸入分支與其 handler / state；只保留「錄製」按鈕（點擊後按鍵錄製）。下載與音樂兩組快捷鍵皆同。
- 連帶移除孤立的 `hotkeyMode` / `musicHotkeyMode` / `handleHotkeyInput` / `handleMusicHotkeyInput` / 對應 timer 與 `.hotkey-mode-switch` / `.hotkey-mode-btn` CSS。`hotkey_type` i18n key 變為未用（保留，無害）。

## 4. 架構

### 4.1 前端

- **路由**：新 `src/routes/linkgrabber/+page.svelte`。
- **Nav**：`src/lib/nav-config.ts` 加一筆（label key `linkgrabber.title`，icon，group/order 比照現有）。
- **Store**：`src/lib/stores/linkgrabber-store.svelte.ts`，Svelte 5 runes（`$state` 陣列），含 CRUD + localStorage 持久化 + 進度同步 helper。
- **項目資料模型**（見 §5）。
- **元件重用**：逐列直接用 `MediaPreview`（以 props 餵每列自己的 preview 資料，不走全域 `media-preview-store`）、`FormatSelector`、`QualityPicker`、`DownloadModeSelector`；新增 `LinkGrabberRow.svelte`、`MusicMetaPanel.svelte`。
- **每列抓取**：`invoke("get_media_formats", { url })` 取格式；preview 透過既有 `prefetch_media_info` 指令（或 `media-info-preview` 事件）逐項取得後存入該列。
- **事件監聽**：`download-listener.ts` 加 `linkgrabber-add` 監聽 → 呼叫 store 加項目並觸發抓取。`hotkey-download-queued` 文案改「已加入待下載清單」。

### 4.2 後端

- **快捷鍵改線**（`src-tauri/src/hotkey.rs`）：`handle_download_clipboard` / `handle_music_clipboard` 不再 `queue_url_with_defaults`；改為：讀剪貼簿 → 驗證 URL → `registry.find_platform(url)` 命中才 `app.emit("linkgrabber-add", { url, mode })`，未命中發提示事件。保留 http(s) 與 parse 檢查。
- **`download_from_url` 擴充**（`src-tauri/src/commands/downloads.rs`）：新增 optional 參數 `embed_thumbnail: Option<bool>`、`embed_metadata: Option<bool>`、`cover_path: Option<String>`、`meta_title/meta_artist/meta_album: Option<String>`。未帶時沿用全域設定（向後相容）。
- **下載引擎 / 嵌入**（`src-tauri/src/core/queue.rs` + `omniget-core/.../ffmpeg.rs`）：把上述逐筆覆寫透傳到 metadata 嵌入階段；`embed_metadata()` 擴充為可吃本機封面檔路徑（`cover_path`）與顯式 title/artist/album（`MetadataEmbed` 增欄位），有 `cover_path` 時以該檔為封面，否則沿用 `thumbnail_url`。

### 4.3 IPC 契約異動摘要

- **新事件**：`linkgrabber-add { url, mode }`（後端→前端）；`linkgrabber-add-rejected { url }`（可選，未支援連結提示）。
- **改語意**：`hotkey-download-queued` 仍存在但實務上由「直接下載」轉為配合 LinkGrabber；文案調整。
- **改指令**：`download_from_url` 新增上述 optional 參數。
- **沿用指令**：`get_media_formats`、`prefetch_media_info`。

## 5. 資料模型（TypeScript）

```ts
type LinkGrabberMode = "video" | "audio";
type LinkGrabberStatus = "pending" | "fetching" | "ready" | "error";

interface LinkGrabberItem {
  id: string;                 // uuid
  url: string;
  mode: LinkGrabberMode;
  status: LinkGrabberStatus;
  // 抓取結果
  title?: string;
  author?: string;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  formats: FormatInfo[];      // get_media_formats 結果
  formatError?: string;
  // 使用者選擇（預帶設定預設值）
  selectedQuality: string;    // "best" | "1080p" | ...
  selectedFormatId: string | null;
  // 音訊專屬（Phase 2）
  audio?: {
    embedThumbnail: boolean;
    embedMetadata: boolean;
    coverPath?: string | null;   // 自訂封面本機路徑
    metaTitle?: string;
    metaArtist?: string;
    metaAlbum?: string;
  };
  addedAt: number;
}
```

## 6. i18n

- 新增 `linkgrabber.*`：`title`、`empty`、`add_placeholder`、`add_button`、`start`、`start_all`、`status_pending/fetching/ready/error`、`retry`、`remove`、`unsupported_url`、音樂面板 `embed_cover`、`upload_cover`、`embed_metadata`、`meta_title/meta_artist/meta_album` 等。
- 修改 `toast.hotkey_download_queued` → 文案改「已加入待下載清單」（10 語系）。
- 全部 key 加進 en.json 後 `pnpm generate:i18n-keys`，並補齊 9 語系（strict build）。

## 7. 分階段（同次交付，邏輯分層）

- Phase 1：§4.1 + 快捷鍵改線 + 持久化 + 影 / 音 / 畫質 / 格式（重用元件）+ 開始下載（用現有 `download_from_url`，音訊走全域 embed 預設）。
- Phase 2：`download_from_url` 與引擎 / ffmpeg 擴充 + 音樂列封面上傳 / metadata 編輯 UI。

## 8. 測試與驗證

- 型別：`pnpm check`（0 errors）。
- i18n：`pnpm generate:i18n-keys` 顯示 9 語系同步。
- Rust：`cargo fmt --all`、`cargo clippy --workspace --all-targets`、`cargo test --workspace`。
- 後端單元測試：`download_from_url` 新參數預設沿用全域、明帶時覆寫；`embed_metadata` 用 `cover_path` 與顯式 metadata。
- 手動 E2E（裝機）：⌘⇧D / ⌘⇧M 加入清單→改畫質 / 格式→開始→出現在下載佇列；音訊上傳封面→產物含封面；關閉重開 App→清單仍在。

## 9. 風險 / 注意

- **元件耦合**：`MediaPreview` 為 dumb 元件但主頁餵全域 store；多列務必改餵 props（探勘已確認可行）。
- **每列格式抓取成本**：多筆同時抓 `get_media_formats` 需節流 / 並行上限，避免一次塞爆 yt-dlp。
- **持久化大小**：`formats` 可能不小；localStorage 有容量限制，必要時只存精簡欄位、重開時可重抓。
- **ffmpeg 封面嵌入**：本機圖檔作為 attached_pic 的參數需對音訊容器（m4a/mp3/flac/opus）分別驗證。
- **向後相容**：`download_from_url` 新參數一律 optional，舊呼叫點（主下載頁）不需改即維持原行為。
