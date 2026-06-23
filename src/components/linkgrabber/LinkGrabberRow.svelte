<script lang="ts">
  import { t } from "$lib/i18n";
  import MediaPreview from "$components/omnibox/MediaPreview.svelte";
  import QualityPicker from "$components/omnibox/QualityPicker.svelte";
  import MusicMetaPanel from "$components/linkgrabber/MusicMetaPanel.svelte";
  import {
    updateItem,
    removeItem,
    enqueueFetch,
    persist,
    type LinkGrabberItem,
    type LinkGrabberAudio,
  } from "$lib/stores/linkgrabber-store.svelte";

  type Props = {
    item: LinkGrabberItem;
    onStart: (id: string) => void;
  };

  let { item, onStart }: Props = $props();

  const defaultAudio: LinkGrabberAudio = {
    embedThumbnail: true,
    embedMetadata: true,
    coverPath: null,
  };

  const preview = $derived({
    thumbnail_url: item.thumbnailUrl ?? null,
    title: item.title ?? item.url,
    author: item.author ?? "",
    duration_seconds: item.durationSeconds ?? null,
  });

  function setMode(mode: "video" | "audio") {
    const patch: Partial<LinkGrabberItem> = { mode };
    if (mode === "audio" && !item.audio) {
      patch.audio = { ...defaultAudio };
    }
    updateItem(item.id, patch);
  }

  function selectFormat(value: string) {
    updateItem(item.id, { selectedFormatId: value || null });
  }

  function onAudioChange(patch: Partial<LinkGrabberAudio>) {
    updateItem(item.id, { audio: { ...(item.audio ?? defaultAudio), ...patch } });
  }

  function formatLabel(f: LinkGrabberItem["formats"][number]): string {
    const parts: string[] = [];
    if (f.resolution) parts.push(f.resolution);
    parts.push(f.ext);
    if (f.has_video && f.has_audio) parts.push("V+A");
    else if (f.has_video) parts.push("V");
    else if (f.has_audio) parts.push("A");
    if (f.filesize) parts.push(`${(f.filesize / (1024 * 1024)).toFixed(0)} MB`);
    return parts.join(" · ");
  }

  const statusKey = $derived(`linkgrabber.status_${item.status}` as const);

  // QualityPicker only exposes a two-way binding, so persist when it changes.
  $effect(() => {
    void item.selectedQuality;
    persist();
  });
</script>

<div class="lg-row" class:error={item.status === "error"}>
  <div class="lg-head">
    <MediaPreview mediaPreview={preview} />
    <div class="lg-head-actions">
      <span class="status" data-status={item.status}>
        <span class="dot" aria-hidden="true"></span>
        {$t(statusKey)}
      </span>
      <button class="icon-btn" type="button" onclick={() => removeItem(item.id)} title={$t("linkgrabber.remove") as string} aria-label={$t("linkgrabber.remove") as string}>×</button>
    </div>
  </div>

  {#if item.status === "error"}
    <div class="lg-err">
      <span>{item.formatError ?? $t("linkgrabber.status_error")}</span>
      <button class="text-btn" type="button" onclick={() => enqueueFetch(item.id)}>{$t("linkgrabber.retry")}</button>
    </div>
  {/if}

  <div class="lg-controls">
    <div class="mode-toggle" role="group">
      <button class="seg" class:active={item.mode === "video"} type="button" onclick={() => setMode("video")}>{$t("linkgrabber.mode_video")}</button>
      <button class="seg" class:active={item.mode === "audio"} type="button" onclick={() => setMode("audio")}>{$t("linkgrabber.mode_audio")}</button>
    </div>

    {#if item.mode === "video"}
      <QualityPicker bind:selectedQuality={item.selectedQuality} selectedFormatId={item.selectedFormatId} />
      {#if item.formats.length > 0}
        <label class="fmt">
          <select
            class="fmt-select"
            value={item.selectedFormatId ?? ""}
            onchange={(e) => selectFormat(e.currentTarget.value)}
          >
            <option value="">{$t("omnibox.mode_auto")}</option>
            {#each item.formats as f (f.format_id)}
              <option value={f.format_id}>{formatLabel(f)}</option>
            {/each}
          </select>
        </label>
      {/if}
    {:else if item.audio}
      <MusicMetaPanel
        audio={item.audio}
        defaultTitle={item.title ?? ""}
        defaultArtist={item.author ?? ""}
        onChange={onAudioChange}
      />
    {/if}
  </div>

  <div class="lg-foot">
    <button
      class="start-btn"
      type="button"
      disabled={item.status !== "ready"}
      onclick={() => onStart(item.id)}
    >
      {$t("linkgrabber.start")}
    </button>
  </div>
</div>

<style>
  .lg-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 12px);
    padding: var(--space-4, 16px);
    background: var(--surface, #1c1c1e);
    border: 1px solid var(--border, #2c2c2e);
    border-radius: var(--radius-md, 11px);
  }

  .lg-row.error {
    border-color: color-mix(in srgb, var(--error, #ff453a) 45%, var(--border));
  }

  .lg-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3, 12px);
  }

  .lg-head-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2, 8px);
    flex-shrink: 0;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--text-xs, 12px);
    color: var(--text-muted, #98989f);
    white-space: nowrap;
  }

  .status .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--text-dim, #636366);
  }

  .status[data-status="ready"] .dot {
    background: var(--success, #30d158);
  }
  .status[data-status="fetching"] .dot,
  .status[data-status="pending"] .dot {
    background: var(--accent);
  }
  .status[data-status="error"] .dot {
    background: var(--error, #ff453a);
  }

  .icon-btn {
    border: none;
    background: none;
    color: var(--text-muted, #98989f);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: var(--radius-xs, 6px);
  }

  @media (hover: hover) {
    .icon-btn:hover {
      background: var(--surface-hi, #2c2c2e);
      color: var(--text, #f2f2f7);
    }
  }

  .lg-err {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3, 12px);
    font-size: var(--text-xs, 12px);
    color: var(--error, #ff453a);
  }

  .text-btn {
    border: none;
    background: none;
    color: var(--accent);
    font-weight: 500;
    cursor: pointer;
    font-size: var(--text-xs, 12px);
  }

  .lg-controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 12px);
  }

  .mode-toggle {
    display: inline-flex;
    align-self: flex-start;
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
    padding: 6px 16px;
    cursor: pointer;
  }

  .seg.active {
    background: var(--accent);
    color: var(--on-accent, #fff);
  }

  .fmt {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .fmt-select {
    height: 36px;
    padding: 0 10px;
    font-size: var(--text-sm, 13.5px);
    color: var(--text, #f2f2f7);
    background: var(--input-bg, #1c1c1e);
    border: 1px solid var(--input-border, #2c2c2e);
    border-radius: var(--radius-xs, 6px);
  }

  .lg-foot {
    display: flex;
    justify-content: flex-end;
  }

  .start-btn {
    font-size: var(--text-sm, 13.5px);
    font-weight: 600;
    padding: 8px 18px;
    border-radius: var(--radius-sm, 8px);
    border: 1px solid transparent;
    background: var(--accent);
    color: var(--on-accent, #fff);
    cursor: pointer;
  }

  .start-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .start-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
