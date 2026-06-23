<script lang="ts">
  import { t } from "$lib/i18n";
  import { invoke } from "@tauri-apps/api/core";
  import LinkGrabberRow from "$components/linkgrabber/LinkGrabberRow.svelte";
  import {
    getItems,
    addItem,
    clearAll,
    enqueueFetch,
    removeItem,
    type LinkGrabberItem,
    type LinkGrabberMode,
  } from "$lib/stores/linkgrabber-store.svelte";
  import { getSettings } from "$lib/stores/settings-store.svelte";
  import { showToast } from "$lib/stores/toast-store.svelte";

  let manualUrl = $state("");
  let manualMode = $state<LinkGrabberMode>("video");

  const items = $derived(getItems());
  const readyCount = $derived(items.filter((i) => i.status === "ready").length);

  function defaultQuality(): string {
    const q = getSettings()?.download.video_quality;
    return typeof q === "string" && q ? q : "best";
  }

  function addManual() {
    const u = manualUrl.trim();
    if (!u) return;
    const item = addItem(u, manualMode, defaultQuality());
    manualUrl = "";
    if (item) enqueueFetch(item.id);
  }

  async function resolveOutputDir(): Promise<string | null> {
    const settings = getSettings();
    let dir = settings?.download.default_output_dir ?? "";
    if (!dir) {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        title: $t("settings.download.default_output_dir") as string,
      });
      if (typeof selected !== "string") return null;
      dir = selected;
    }
    return dir;
  }

  async function startItem(item: LinkGrabberItem, outputDir: string): Promise<boolean> {
    try {
      await invoke("download_from_url", {
        url: item.url,
        outputDir,
        downloadMode: item.mode === "audio" ? "audio" : null,
        quality: item.selectedQuality,
        formatId: item.selectedFormatId,
        embedThumbnail: item.audio?.embedThumbnail ?? null,
        embedMetadata: item.audio?.embedMetadata ?? null,
        coverPath: item.audio?.coverPath ?? null,
        metaTitle: item.audio?.metaTitle || null,
        metaArtist: item.audio?.metaArtist || null,
        metaAlbum: item.audio?.metaAlbum || null,
      });
      removeItem(item.id);
      return true;
    } catch (e) {
      showToast("error", typeof e === "string" ? e : String(e));
      return false;
    }
  }

  async function startOne(id: string) {
    const item = getItems().find((i) => i.id === id);
    if (!item || item.status !== "ready") return;
    const dir = await resolveOutputDir();
    if (!dir) return;
    if (await startItem(item, dir)) {
      showToast("success", $t("toast.download_started", { name: item.title ?? item.url }));
    }
  }

  async function startAll() {
    const ready = getItems().filter((i) => i.status === "ready");
    if (ready.length === 0) return;
    const dir = await resolveOutputDir();
    if (!dir) return;
    for (const item of ready) {
      await startItem(item, dir);
    }
  }
</script>

<div class="linkgrabber">
  <div class="page-head">
    <h1 class="page-title">{$t("linkgrabber.title")}</h1>
  </div>

  <div class="add-bar">
    <input
      class="add-input"
      type="text"
      placeholder={$t("linkgrabber.add_placeholder") as string}
      bind:value={manualUrl}
      onkeydown={(e) => { if (e.key === "Enter") addManual(); }}
      spellcheck="false"
    />
    <div class="mode-toggle" role="group">
      <button class="seg" class:active={manualMode === "video"} type="button" onclick={() => (manualMode = "video")}>{$t("linkgrabber.mode_video")}</button>
      <button class="seg" class:active={manualMode === "audio"} type="button" onclick={() => (manualMode = "audio")}>{$t("linkgrabber.mode_audio")}</button>
    </div>
    <button class="add-btn" type="button" onclick={addManual} disabled={!manualUrl.trim()}>{$t("linkgrabber.add_button")}</button>
  </div>

  {#if items.length > 0}
    <div class="toolbar">
      <button class="tool-btn primary" type="button" onclick={startAll} disabled={readyCount === 0}>
        {$t("linkgrabber.start_all")}{readyCount > 0 ? ` (${readyCount})` : ""}
      </button>
      <button class="tool-btn" type="button" onclick={clearAll}>{$t("linkgrabber.clear_all")}</button>
    </div>

    <div class="rows">
      {#each items as item (item.id)}
        <LinkGrabberRow {item} onStart={startOne} />
      {/each}
    </div>
  {:else}
    <div class="empty">
      <p>{$t("linkgrabber.empty")}</p>
    </div>
  {/if}
</div>

<style>
  .linkgrabber {
    display: flex;
    flex-direction: column;
    gap: var(--space-4, 16px);
    align-items: center;
    padding: var(--space-5, 24px) var(--padding, 12px);
  }

  .linkgrabber > * {
    width: 100%;
    max-width: 680px;
  }

  .page-head {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .page-title {
    font-size: 24px;
    font-weight: 500;
    margin: 0;
  }

  .add-bar {
    display: flex;
    align-items: center;
    gap: var(--space-2, 8px);
    flex-wrap: wrap;
  }

  .add-input {
    flex: 1 1 240px;
    height: 40px;
    padding: 0 12px;
    font-size: var(--text-sm, 13.5px);
    color: var(--text, #f2f2f7);
    background: var(--input-bg, #1c1c1e);
    border: 1px solid var(--input-border, #2c2c2e);
    border-radius: var(--radius-sm, 8px);
  }

  .add-input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .mode-toggle {
    display: inline-flex;
    border: 1px solid var(--border, #2c2c2e);
    border-radius: var(--radius-sm, 8px);
    overflow: hidden;
  }

  .seg {
    border: none;
    background: var(--surface, #1c1c1e);
    color: var(--text-muted, #98989f);
    font-size: var(--text-sm, 13.5px);
    font-weight: 500;
    padding: 8px 14px;
    cursor: pointer;
  }

  .seg.active {
    background: var(--accent);
    color: var(--on-accent, #fff);
  }

  .add-btn {
    height: 40px;
    padding: 0 18px;
    font-size: var(--text-sm, 13.5px);
    font-weight: 600;
    color: var(--on-accent, #fff);
    background: var(--accent);
    border: 1px solid transparent;
    border-radius: var(--radius-sm, 8px);
    cursor: pointer;
  }

  .add-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .toolbar {
    display: flex;
    gap: var(--space-2, 8px);
    justify-content: flex-end;
  }

  .tool-btn {
    font-size: var(--text-sm, 13.5px);
    font-weight: 500;
    padding: 7px 14px;
    border-radius: var(--radius-sm, 8px);
    border: 1px solid var(--border, #2c2c2e);
    background: var(--surface, #1c1c1e);
    color: var(--text, #f2f2f7);
    cursor: pointer;
  }

  .tool-btn.primary {
    background: var(--accent);
    color: var(--on-accent, #fff);
    border-color: transparent;
  }

  .tool-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 12px);
  }

  .empty {
    text-align: center;
    color: var(--text-muted, #98989f);
    font-size: var(--text-sm, 13.5px);
    padding: var(--space-7, 48px) 0;
    line-height: 1.6;
  }
</style>
