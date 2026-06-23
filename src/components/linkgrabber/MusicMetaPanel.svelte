<script lang="ts">
  import { t } from "$lib/i18n";
  import type { LinkGrabberAudio } from "$lib/stores/linkgrabber-store.svelte";

  type Props = {
    audio: LinkGrabberAudio;
    onChange: (patch: Partial<LinkGrabberAudio>) => void;
  };

  let { audio, onChange }: Props = $props();

  const FORMATS = ["m4a", "mp3", "flac", "opus", "wav"] as const;
  const BITRATES = ["128", "192", "256", "320"] as const;

  async function pickCover() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const picked = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "Image", extensions: ["jpg", "jpeg", "png", "webp"] }],
      });
      if (typeof picked === "string") onChange({ coverPath: picked });
    } catch {
      // dialog cancelled or unavailable — leave cover unchanged
    }
  }

  function coverName(p?: string | null): string {
    if (!p) return "";
    return p.split(/[\\/]/).pop() ?? p;
  }
</script>

<div class="music-meta">
  <div class="selects">
    <label class="sel">
      <span class="sel-label">{$t("linkgrabber.audio_format")}</span>
      <select
        class="sel-ctrl"
        value={audio.format}
        onchange={(e) => onChange({ format: e.currentTarget.value })}
      >
        <option value="auto">{$t("linkgrabber.auto")}</option>
        {#each FORMATS as f}
          <option value={f}>{f.toUpperCase()}</option>
        {/each}
      </select>
    </label>
    <label class="sel">
      <span class="sel-label">{$t("linkgrabber.audio_quality")}</span>
      <select
        class="sel-ctrl"
        value={audio.quality}
        onchange={(e) => onChange({ quality: e.currentTarget.value })}
      >
        <option value="">{$t("linkgrabber.auto")}</option>
        {#each BITRATES as b}
          <option value={b}>{b} kbps</option>
        {/each}
      </select>
    </label>
  </div>

  <div class="meta-row">
    <label class="check">
      <input
        type="checkbox"
        checked={audio.embedThumbnail}
        onchange={(e) => onChange({ embedThumbnail: e.currentTarget.checked })}
      />
      <span>{$t("linkgrabber.embed_cover")}</span>
    </label>
    <div class="cover-actions">
      {#if audio.embedThumbnail}
        <select
          class="shape-select"
          value={audio.coverShape}
          aria-label={$t("linkgrabber.cover_shape") as string}
          onchange={(e) => onChange({ coverShape: e.currentTarget.value })}
        >
          <option value="square">{$t("linkgrabber.shape_square")}</option>
          <option value="original">{$t("linkgrabber.shape_original")}</option>
        </select>
      {/if}
      <button class="upload-btn" type="button" onclick={pickCover}>
        {$t("linkgrabber.upload_cover")}
      </button>
    </div>
  </div>

  {#if audio.coverPath}
    <p class="cover-name">
      {$t("linkgrabber.cover_custom")}: <span>{coverName(audio.coverPath)}</span>
      <button class="clear-cover" type="button" onclick={() => onChange({ coverPath: null })} aria-label="clear">×</button>
    </p>
  {/if}

  <label class="check">
    <input
      type="checkbox"
      checked={audio.embedMetadata}
      onchange={(e) => onChange({ embedMetadata: e.currentTarget.checked })}
    />
    <span>{$t("linkgrabber.embed_metadata")}</span>
  </label>
</div>

<style>
  .music-meta {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 12px);
    padding: var(--space-3, 12px);
    background: var(--surface, #1c1c1e);
    border: 1px solid var(--border, #2c2c2e);
    border-radius: var(--radius-sm, 8px);
  }

  .selects {
    display: flex;
    gap: var(--space-3, 12px);
    flex-wrap: wrap;
  }

  .sel {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1 1 140px;
  }

  .sel-label {
    font-size: var(--text-xs, 12px);
    color: var(--text-muted, #98989f);
  }

  .sel-ctrl {
    height: 34px;
    padding: 0 10px;
    font-size: var(--text-sm, 13.5px);
    color: var(--text, #f2f2f7);
    background: var(--input-bg, #1c1c1e);
    border: 1px solid var(--input-border, #2c2c2e);
    border-radius: var(--radius-xs, 6px);
  }

  .meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3, 12px);
  }

  .check {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: var(--text-sm, 13.5px);
    color: var(--text, #f2f2f7);
    cursor: pointer;
  }

  .check input {
    accent-color: var(--accent);
  }

  .cover-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2, 8px);
  }

  .shape-select {
    height: 30px;
    padding: 0 8px;
    font-size: var(--text-xs, 12px);
    color: var(--text, #f2f2f7);
    background: var(--input-bg, #1c1c1e);
    border: 1px solid var(--input-border, #2c2c2e);
    border-radius: var(--radius-xs, 6px);
  }

  .upload-btn {
    font-size: var(--text-xs, 12px);
    font-weight: 500;
    padding: 5px 10px;
    border-radius: var(--radius-xs, 6px);
    border: 1px solid var(--border, #2c2c2e);
    background: var(--surface-hi, #2c2c2e);
    color: var(--text, #f2f2f7);
    cursor: pointer;
  }

  @media (hover: hover) {
    .upload-btn:hover {
      border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
    }
  }

  .cover-name {
    margin: 0;
    font-size: var(--text-xs, 12px);
    color: var(--text-muted, #98989f);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .cover-name span {
    font-family: var(--font-mono, monospace);
    color: var(--text, #f2f2f7);
  }

  .clear-cover {
    border: none;
    background: none;
    color: var(--text-muted, #98989f);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 0 2px;
  }
</style>
