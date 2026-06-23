<script lang="ts">
  import { t } from "$lib/i18n";
  import type { LinkGrabberAudio } from "$lib/stores/linkgrabber-store.svelte";

  type Props = {
    audio: LinkGrabberAudio;
    defaultTitle?: string;
    defaultArtist?: string;
    onChange: (patch: Partial<LinkGrabberAudio>) => void;
  };

  let { audio, defaultTitle = "", defaultArtist = "", onChange }: Props = $props();

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
  <div class="meta-row">
    <label class="check">
      <input
        type="checkbox"
        checked={audio.embedThumbnail}
        onchange={(e) => onChange({ embedThumbnail: e.currentTarget.checked })}
      />
      <span>{$t("linkgrabber.embed_cover")}</span>
    </label>
    <button class="upload-btn" type="button" onclick={pickCover}>
      {$t("linkgrabber.upload_cover")}
    </button>
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

  {#if audio.embedMetadata}
    <div class="fields">
      <input
        class="meta-input"
        placeholder={defaultTitle || ($t("linkgrabber.meta_title") as string)}
        value={audio.metaTitle ?? ""}
        oninput={(e) => onChange({ metaTitle: e.currentTarget.value })}
      />
      <input
        class="meta-input"
        placeholder={defaultArtist || ($t("linkgrabber.meta_artist") as string)}
        value={audio.metaArtist ?? ""}
        oninput={(e) => onChange({ metaArtist: e.currentTarget.value })}
      />
      <input
        class="meta-input"
        placeholder={$t("linkgrabber.meta_album") as string}
        value={audio.metaAlbum ?? ""}
        oninput={(e) => onChange({ metaAlbum: e.currentTarget.value })}
      />
    </div>
  {/if}
</div>

<style>
  .music-meta {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 8px);
    padding: var(--space-3, 12px);
    background: var(--surface, #1c1c1e);
    border: 1px solid var(--border, #2c2c2e);
    border-radius: var(--radius-sm, 8px);
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

  .fields {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .meta-input {
    height: 32px;
    padding: 0 10px;
    font-size: var(--text-sm, 13.5px);
    color: var(--text, #f2f2f7);
    background: var(--input-bg, #1c1c1e);
    border: 1px solid var(--input-border, #2c2c2e);
    border-radius: var(--radius-xs, 6px);
  }

  .meta-input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
</style>
