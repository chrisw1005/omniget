# LinkGrabber Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a JDownloader-style "LinkGrabber" staging page: ⌘⇧D/⌘⇧M (and manual paste) add recognized media URLs to a persistent list where each item's format/quality (and, for audio, cover/metadata) can be tuned before starting the real download.

**Architecture:** Hotkeys stop auto-downloading; they emit `linkgrabber-add`. A new persisted Svelte store holds items; a new `/linkgrabber` route renders one row per item reusing the existing omnibox config components. "Start" submits via the existing `download_from_url` command, extended with optional per-item embed/cover/metadata params (backward compatible).

**Tech Stack:** Tauri 2 (Rust), SvelteKit 2 / Svelte 5 runes, TypeScript strict, tauri-plugin-clipboard-manager, ffmpeg embed, Vitest (logic tests), cargo test.

## Global Constraints

- Package manager: pnpm@10.29.3. Frontend static check: `pnpm check` (no eslint/prettier).
- i18n: nested JSON per locale in `src/lib/i18n/`; 10 locales `en, ru, el, pt, zh, zh-TW, ja, it, fr, es`; after editing en.json run `pnpm generate:i18n-keys`; strict build requires all 9 other locales in sync.
- Rust pre-PR: from `src-tauri/` run `cargo fmt --all`, `cargo clippy --workspace --all-targets`, `cargo test --workspace`.
- Git commit messages in English. Commit trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01Pp7pvJbEu6X8Q4hCyLNBNb`.
- All work on branch `feat/linkgrabber`. Single PR at the end.
- `download_from_url` new params MUST be optional; existing call site (`src/routes/+page.svelte`) must keep working unchanged.
- Triggers limited to URLs that `PlatformRegistry::find_platform(url)` recognizes.
- Brand accent is orange (`--accent`), never hardcode blue; reuse design tokens.

---

## File Structure

**Create:**
- `src/lib/stores/linkgrabber-store.svelte.ts` — item model, CRUD, localStorage persistence, fetch orchestration.
- `src/lib/stores/linkgrabber-store.test.ts` — Vitest logic tests.
- `src/routes/linkgrabber/+page.svelte` — the page (list + manual-add input + batch start).
- `src/components/linkgrabber/LinkGrabberRow.svelte` — one item row (reuses omnibox components).
- `src/components/linkgrabber/MusicMetaPanel.svelte` — audio cover/metadata sub-panel.

**Modify:**
- `src-tauri/src/commands/downloads.rs` — extend `download_from_url` signature + thread params into queue.
- `src-tauri/src/core/queue.rs` — apply per-item embed/cover/metadata overrides at the embed step (~1592).
- `src-tauri/omniget-core/src/core/ffmpeg.rs` — extend `MetadataEmbed` + `embed_metadata` to accept a local cover file + explicit title/artist/album.
- `src-tauri/src/hotkey.rs` — `handle_download_clipboard`/`handle_music_clipboard` emit `linkgrabber-add` (with registry validation); drop `enqueue_from_clipboard` + `hotkey-download-queued`.
- `src/lib/stores/download-listener.ts` — replace `hotkey-download-queued` listener with `linkgrabber-add`; keep `notify()` helper.
- `src/lib/nav-config.ts` — add LinkGrabber nav item.
- `src/components/settings/downloads/ClipboardHotkeysSection.svelte` — A1: remove Type mode.
- `src/lib/i18n/en.json` (+ 9 locales) + `src/lib/i18n/keys.ts` — add `linkgrabber.*`; repurpose `toast.hotkey_download_queued`.

---

## Task 1: Extend ffmpeg embed to accept local cover + explicit metadata

**Files:**
- Modify: `src-tauri/omniget-core/src/core/ffmpeg.rs`
- Test: same file `#[cfg(test)]` module.

**Interfaces:**
- Produces: `MetadataEmbed { title: Option<String>, artist: Option<String>, album: Option<String>, thumbnail_url: Option<String>, cover_path: Option<String>, .. }` and `embed_metadata(path, &MetadataEmbed, embed_thumbnail: bool, http) -> Result<()>` where a present `cover_path` takes precedence over `thumbnail_url` as the attached cover image.

- [ ] **Step 1: Read current `MetadataEmbed` struct and `embed_metadata` fn** in `ffmpeg.rs`; note exact fields and the ffmpeg arg construction.

- [ ] **Step 2: Add fields** `album: Option<String>` and `cover_path: Option<String>` to `MetadataEmbed` (keep `..Default::default()` callers working via `#[derive(Default)]`).

- [ ] **Step 3: Update `embed_metadata`** so that when `cover_path` is `Some(p)` and the file exists, it uses `p` as the attached-picture input instead of downloading `thumbnail_url`; map `-metadata album=` when `album` is `Some`. Preserve current behavior when `cover_path` is `None`.

- [ ] **Step 4: Unit test** `test_metadata_embed_prefers_cover_path` — construct a `MetadataEmbed` with `cover_path: Some(<temp jpg>)` and assert the built ffmpeg args reference that path (refactor arg-building into a pure helper `fn build_embed_args(input, meta, embed_thumbnail, cover_input) -> Vec<String>` if needed for testability).

- [ ] **Step 5: Run** `cd src-tauri && cargo test -p omniget-core ffmpeg` → PASS.

- [ ] **Step 6: Commit** `feat(core): ffmpeg embed accepts local cover and album/title/artist overrides`.

---

## Task 2: Extend `download_from_url` with optional per-item params

**Files:**
- Modify: `src-tauri/src/commands/downloads.rs` (signature ~850; enqueue path)
- Modify: `src-tauri/src/core/queue.rs` (embed step ~1592)
- Test: `src-tauri/src/commands/downloads.rs` `#[cfg(test)]` or an integration test for param plumbing.

**Interfaces:**
- Consumes: `MetadataEmbed.cover_path/album` from Task 1.
- Produces: `download_from_url(.., embed_thumbnail: Option<bool>, embed_metadata: Option<bool>, cover_path: Option<String>, meta_title: Option<String>, meta_artist: Option<String>, meta_album: Option<String>)`. When `None`, fall back to `settings.download.embed_thumbnail / embed_metadata` and auto title/artist (current behavior).

- [ ] **Step 1: Add the six optional params** to `download_from_url` signature (all `Option<_>`, appended last so existing JS call by-name stays valid).

- [ ] **Step 2: Thread them** into the queued item / download options struct used by `queue.rs`. Find the struct the command builds and add the override fields.

- [ ] **Step 3: At the embed step in `queue.rs`** (~1592), prefer per-download overrides over `settings.download.*`: `let embed_meta = override_embed_metadata.unwrap_or(settings.download.embed_metadata);` etc.; build `MetadataEmbed { title: meta_title.or(Some(info.title)), artist: meta_artist.or(Some(info.author)), album: meta_album, cover_path, thumbnail_url: info.thumbnail_url, .. }`.

- [ ] **Step 4: Test** `test_download_overrides_fall_back_to_settings` and `test_download_overrides_take_precedence` on the option-resolution helper (extract `fn resolve_embed(opts, settings) -> ResolvedEmbed` so it is pure and testable).

- [ ] **Step 5: Run** `cd src-tauri && cargo test -p omniget downloads` (or the test name) → PASS. Then `cargo check` whole workspace.

- [ ] **Step 6: Commit** `feat(downloads): download_from_url accepts optional per-item embed/cover/metadata`.

---

## Task 3: Rewire hotkeys to feed LinkGrabber

**Files:**
- Modify: `src-tauri/src/hotkey.rs`
- Test: `src-tauri/src/hotkey.rs` `#[cfg(test)]` for the URL/platform gate helper.

**Interfaces:**
- Produces: on hotkey press with a recognized media URL on the clipboard, emits Tauri event `linkgrabber-add` with payload `{ "url": String, "mode": "video" | "audio" }`. Unrecognized/non-URL → emits `linkgrabber-add-rejected { "url" }` (or no-op + log).
- Removes: `enqueue_from_clipboard`, `handle_music_clipboard`'s direct enqueue, and the `hotkey-download-queued` emit.

- [ ] **Step 1: Add helper** `fn clipboard_media_url(app) -> Option<String>` that reads clipboard, trims, validates http(s) + `url::Url::parse`, and returns the URL only if `state.registry.find_platform(&url).is_some()`. (Access registry via `AppState`.)

- [ ] **Step 2: Replace** `handle_download_clipboard` body: if `Some(url) = clipboard_media_url(app)` → `app.emit("linkgrabber-add", json!({"url": url, "mode": "video"}))`; else `app.emit("linkgrabber-add-rejected", json!({"url": raw}))`.

- [ ] **Step 3: Replace** `handle_music_clipboard` similarly with `"mode": "audio"`.

- [ ] **Step 4: Delete** `enqueue_from_clipboard` and any now-unused imports (`external_url::queue_url_with_defaults` if unused elsewhere — verify with grep first; it is still used by `extension_storage`/`channel_poller`, so keep the import only if still referenced in this file — likely remove from `hotkey.rs`).

- [ ] **Step 5: Test** `test_clipboard_media_url_rejects_non_platform` / `accepts_known_platform` using a registry fixture (or test the pure URL-shape checks if registry needs full app state — at minimum test http(s)+parse gate).

- [ ] **Step 6: Run** `cd src-tauri && cargo test -p omniget hotkey` → PASS; `cargo clippy` clean for the file.

- [ ] **Step 7: Commit** `feat(hotkey): hotkeys add recognized URLs to LinkGrabber instead of downloading`.

---

## Task 4: LinkGrabber store + persistence (Vitest TDD)

**Files:**
- Create: `src/lib/stores/linkgrabber-store.svelte.ts`
- Test: `src/lib/stores/linkgrabber-store.test.ts`

**Interfaces:**
- Produces:
```ts
export type LinkGrabberMode = "video" | "audio";
export type LinkGrabberStatus = "pending" | "fetching" | "ready" | "error";
export interface LinkGrabberItem {
  id: string; url: string; mode: LinkGrabberMode; status: LinkGrabberStatus;
  title?: string; author?: string; thumbnailUrl?: string | null; durationSeconds?: number | null;
  formats: FormatInfo[]; formatError?: string;
  selectedQuality: string; selectedFormatId: string | null;
  audio?: { embedThumbnail: boolean; embedMetadata: boolean; coverPath?: string | null;
            metaTitle?: string; metaArtist?: string; metaAlbum?: string };
  addedAt: number;
}
export function getItems(): LinkGrabberItem[];
export function addItem(url: string, mode: LinkGrabberMode): LinkGrabberItem | null; // dedupe by url; returns null if dup
export function removeItem(id: string): void;
export function updateItem(id: string, patch: Partial<LinkGrabberItem>): void;
export function clearAll(): void;
export function serialize(): string;     // for persistence
export function hydrate(raw: string): void;
```
- Persistence: write `serialize()` to `localStorage["omniget_linkgrabber"]` on every mutation; `hydrate` from it on module init. `FormatInfo` type imported/duplicated from the shared shape used in `+page.svelte` (extract to `src/lib/types/formats.ts` if not already shared — create it and re-export from both).

- [ ] **Step 1: Write failing tests** in `linkgrabber-store.test.ts`: addItem creates a pending item with defaults; addItem dedupes same url (returns null, no second item); removeItem removes; updateItem patches; serialize/hydrate round-trip; persistence calls a mockable storage. Use the Vitest pattern from existing `src/lib/*.test.ts`.

- [ ] **Step 2: Run** `pnpm test -- src/lib/stores/linkgrabber-store.test.ts` → FAIL (module missing).

- [ ] **Step 3: Create `src/lib/types/formats.ts`** exporting the `FormatInfo` type (copy the shape from `src/routes/+page.svelte:47-61`); update `+page.svelte` to import it (no behavior change).

- [ ] **Step 4: Implement the store** with `$state` array, the API above, localStorage persistence guarded by `typeof localStorage !== "undefined"`, default `selectedQuality` from a passed-in default (or `"best"`), `audio` initialized only when `mode === "audio"`.

- [ ] **Step 5: Run** `pnpm test -- src/lib/stores/linkgrabber-store.test.ts` → PASS.

- [ ] **Step 6: Commit** `feat(store): linkgrabber store with localStorage persistence`.

---

## Task 5: Fetch orchestration (preview + formats per item)

**Files:**
- Modify: `src/lib/stores/linkgrabber-store.svelte.ts`
- Test: `src/lib/stores/linkgrabber-store.test.ts`

**Interfaces:**
- Produces: `export async function fetchItem(id: string): Promise<void>` — sets status `fetching`, calls `invoke("get_media_formats", { url })` and `invoke("prefetch_media_info", { url })` (verify exact prefetch command name/shape during impl), fills `title/author/thumbnailUrl/durationSeconds/formats`, sets `ready` or `error`. Concurrency cap: at most 3 in-flight `fetchItem` (simple in-module semaphore).

- [ ] **Step 1: Write failing test** mocking `@tauri-apps/api/core` `invoke` to return canned formats/preview; assert `fetchItem` transitions pending→fetching→ready and populates fields; on invoke throw → status `error` + `formatError` set.

- [ ] **Step 2: Run** the test → FAIL.

- [ ] **Step 3: Implement `fetchItem`** + the concurrency gate; export an `enqueueFetch(id)` used by the page/listener.

- [ ] **Step 4: Run** test → PASS.

- [ ] **Step 5: Commit** `feat(store): per-item media-info + format fetch with concurrency cap`.

---

## Task 6: i18n keys + nav + listener rewire

**Files:**
- Modify: `src/lib/i18n/en.json` (+ run generators), `src/lib/nav-config.ts`, `src/lib/stores/download-listener.ts`

**Interfaces:**
- Produces: nav item `{ href: "/linkgrabber", labelKey: "linkgrabber.title", icon/iconSvg, group, order }`; i18n `linkgrabber.*` keys; `download-listener.ts` listens `linkgrabber-add` → `addItem(url, mode)` + `enqueueFetch(item.id)` + `showToast("success", tr("linkgrabber.added"))` + `notify(...)`; listens `linkgrabber-add-rejected` → `showToast("error", tr("linkgrabber.unsupported_url"))`.

- [ ] **Step 1: Add to `en.json`** under a new top-level `linkgrabber` object: `title, empty, add_placeholder, add_button, start, start_all, clear_all, status_pending, status_fetching, status_ready, status_error, retry, remove, added, unsupported_url, embed_cover, upload_cover, embed_metadata, meta_title, meta_artist, meta_album` (English values). Remove now-obsolete usage of `toast.hotkey_download_queued` (leave the key or delete + resync — prefer delete via en.json + regen).

- [ ] **Step 2: Run** `pnpm generate:i18n-keys` → expect "All 9 other locales in sync" FAILS (missing keys). Add the same keys to the other 9 locale files with proper translations (use a python script writing nested JSON `ensure_ascii=False, indent=2`). Re-run until "in sync".

- [ ] **Step 3: Add nav item** in `nav-config.ts` (place after downloads; pick a Tabler-style `iconSvg` path or `icon` name consistent with others).

- [ ] **Step 4: Rewire `download-listener.ts`**: remove the `hotkey-download-queued` listener + its unlisten; add `unlistenLinkgrabberAdd` and `unlistenLinkgrabberRejected` listeners as above; add both to the cleanup return. Keep the `notify()` helper.

- [ ] **Step 5: Verify** `pnpm check` → 0 errors.

- [ ] **Step 6: Commit** `feat(i18n,nav): linkgrabber strings, nav entry, add/reject listeners`.

---

## Task 7: LinkGrabberRow component (video path)

**Files:**
- Create: `src/components/linkgrabber/LinkGrabberRow.svelte`

**Interfaces:**
- Consumes: `LinkGrabberItem`, store `updateItem/removeItem/enqueueFetch`, and components `MediaPreview`, `DownloadModeSelector`, `QualityPicker`, `FormatSelector` (all prop-driven per Explore map).
- Props: `{ item: LinkGrabberItem; onStart: (id: string) => void }`.

- [ ] **Step 1: Build the row**: thumbnail/title/duration from `item` (pass to `MediaPreview` as props, NOT global store); `DownloadModeSelector` bound to `item.mode` (→ updateItem); `QualityPicker` bound to `item.selectedQuality`/`item.selectedFormatId`; `FormatSelector` fed `item.formats`/loading/error with `onLoadFormats` → `enqueueFetch(item.id)`. Status chip (pending/fetching/ready/error) with icon (no color-alone). `error` shows `retry` → `enqueueFetch`. "開始下載" button → `onStart(item.id)` (disabled unless `ready`). "移除" → `removeItem`.

- [ ] **Step 2: Audio slot placeholder**: if `item.mode === "audio"`, render `<MusicMetaPanel>` (created in Task 8) — leave an import that Task 8 fills; for now a stub element is fine but prefer doing Task 8 first if executing in order.

- [ ] **Step 3: Verify** `pnpm check` → 0 errors.

- [ ] **Step 4: Commit** `feat(linkgrabber): per-item row reusing omnibox config components`.

---

## Task 8: MusicMetaPanel component (audio cover/metadata)

**Files:**
- Create: `src/components/linkgrabber/MusicMetaPanel.svelte`

**Interfaces:**
- Props: `{ audio: NonNullable<LinkGrabberItem["audio"]>; defaultTitle?: string; defaultArtist?: string; onChange: (patch: Partial<LinkGrabberItem["audio"]>) => void }`.

- [ ] **Step 1: Build panel**: `embed_cover` toggle (→ embedThumbnail); `upload_cover` button using `@tauri-apps/plugin-dialog` `open({ filters: [{name:"Image", extensions:["jpg","jpeg","png","webp"]}] })` → set `coverPath`; show chosen filename + a "clear" affordance; `embed_metadata` toggle; text inputs for `meta_title/meta_artist/meta_album` (placeholders = defaults). Each change calls `onChange`.

- [ ] **Step 2: Wire into `LinkGrabberRow`** for `mode === "audio"`, passing `item.audio`, defaults from `item.title/author`, `onChange` → `updateItem(item.id, { audio: { ...item.audio, ...patch } })`.

- [ ] **Step 3: Verify** `pnpm check` → 0 errors.

- [ ] **Step 4: Commit** `feat(linkgrabber): audio cover upload + editable metadata panel`.

---

## Task 9: LinkGrabber page (list + manual add + start)

**Files:**
- Create: `src/routes/linkgrabber/+page.svelte`

**Interfaces:**
- Consumes: store `getItems/addItem/removeItem/clearAll/enqueueFetch`, `download_from_url` invoke, settings defaults for quality/output dir.

- [ ] **Step 1: Page shell**: heading, manual-add row (text input + mode toggle + add button → `addItem(url, mode)` then `enqueueFetch`), `start_all` + `clear_all` buttons, empty state (`linkgrabber.empty`), and `{#each getItems() as item (item.id)}<LinkGrabberRow {item} onStart={startOne} />`.

- [ ] **Step 2: `startOne(id)`**: resolve output dir (same logic as `+page.svelte` uses — settings default), `await invoke("download_from_url", { url, outputDir, downloadMode: item.mode==="audio"?"audio":(item.selectedFormatId?null:"auto"), quality: item.selectedQuality, formatId: item.selectedFormatId, embedThumbnail: item.audio?.embedThumbnail, embedMetadata: item.audio?.embedMetadata, coverPath: item.audio?.coverPath, metaTitle: item.audio?.metaTitle, metaArtist: item.audio?.metaArtist, metaAlbum: item.audio?.metaAlbum })`; on success `removeItem(id)` + toast `linkgrabber.start`/download_started.

- [ ] **Step 3: `start_all`**: iterate ready items calling `startOne` (sequential to avoid clobbering output-dir prompts).

- [ ] **Step 4: Verify** `pnpm check` → 0 errors.

- [ ] **Step 5: Commit** `feat(linkgrabber): staging page with manual add and start/start-all`.

---

## Task 10: A1 — remove hotkey "Type" mode

**Files:**
- Modify: `src/components/settings/downloads/ClipboardHotkeysSection.svelte`

- [ ] **Step 1: Remove** the `hotkey-mode-switch` toggle and the `{#if hotkeyMode === 'type'}<input>{:else}…{/if}` branch for BOTH the download and music hotkey rows; always render the record button.

- [ ] **Step 2: Delete dead script**: `hotkeyMode`, `musicHotkeyMode`, `handleHotkeyInput`, `handleMusicHotkeyInput`, `hotkeyTimer`, `musicHotkeyTimer`; keep `hotkeyInput/musicHotkeyInput`, `*Recording`, `handle*HotkeyKeyDown`, `mapKeyName`, `$effect`.

- [ ] **Step 3: Delete orphaned CSS** `.hotkey-mode-switch`, `.hotkey-mode-btn`.

- [ ] **Step 4: Verify** `pnpm check` → 0 errors.

- [ ] **Step 5: Commit** `feat(settings): hotkey binding uses record-only (remove confusing type mode)`.

---

## Task 11: Integration build, manual E2E, quality gates, PR

- [ ] **Step 1: Rust gates** from `src-tauri/`: `cargo fmt --all`, `cargo clippy --workspace --all-targets` (0 warnings on changed code), `cargo test --workspace`.
- [ ] **Step 2: Frontend gates**: `pnpm check` (0 errors), `pnpm test` (Vitest green).
- [ ] **Step 3: Build** `cargo tauri build --bundles app --config '{"bundle":{"createUpdaterArtifacts":false}}'`; install via pkill -9 + ditto + relaunch with `RUST_LOG=info`.
- [ ] **Step 4: Manual E2E** (record results): (a) copy a YouTube URL, ⌘⇧D → item appears in LinkGrabber as video, formats load; change quality; Start → appears in downloads queue, removed from list. (b) ⌘⇧M → audio item; upload a cover; Start → output file embeds that cover. (c) copy a non-media URL, ⌘⇧D → rejected toast, no item. (d) add via manual paste. (e) restart app → list persists. (f) Settings → hotkey shows record-only.
- [ ] **Step 5: Commit** any fixes; push branch; open PR `feat: LinkGrabber staging list with per-item format/quality and audio cover/metadata`.

---

## Self-Review

- **Spec coverage:** A1 → T10; toast→linkgrabber.added → T6; new page → T9; store+persistence → T4; fetch → T5; hotkey rewire+platform gate → T3; per-item components → T7/T8; backend per-item embed/cover/metadata → T1/T2; nav+i18n → T6. All spec sections mapped.
- **Placeholder scan:** Each task names exact files, exact commands, and concrete interfaces; UI tasks specify component props and the exact `invoke` parameter object rather than vague "build UI".
- **Type consistency:** `LinkGrabberItem`/`FormatInfo` defined in T4 and reused verbatim in T5/T7/T8/T9; `download_from_url` param names (camelCase JS ↔ snake_case Rust) fixed in T2 and reused in T9; `MetadataEmbed.cover_path/album` defined T1, consumed T2.
- **Risk note:** verify exact `prefetch_media_info` command name/shape at T5 impl; verify `download_from_url` is invoked by-name everywhere (only `+page.svelte`) so appended optional params are safe.
