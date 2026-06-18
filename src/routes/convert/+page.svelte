<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { open } from "@tauri-apps/plugin-dialog";
  import { getCurrentWebview } from "@tauri-apps/api/webview";
  import { onMount, onDestroy } from "svelte";
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { t } from "$lib/i18n";
  import { showToast } from "$lib/stores/toast-store.svelte";
  import ContextHint from "$components/hints/ContextHint.svelte";
  import {
    getFiles,
    getHwAccel,
    addFiles,
    removeFile,
    clearFiles,
    setSelected,
    setAllSelected,
    updateFileProbe,
    markFileProbing,
    markFileConverting,
    updateFileOptions,
    setOutputName,
    setThumbnail,
    applyOptionsToAll,
    resetForReconvert,
    setHwAccel,
    type ConvertFile,
    type ProbeInfo,
    type HwAccelInfo,
  } from "$lib/stores/convert-store.svelte";

  const MEDIA_EXT = [
    "mp4", "mkv", "avi", "mov", "webm", "flv", "wmv", "m4v",
    "mp3", "wav", "flac", "aac", "ogg", "m4a", "wma", "opus",
  ];

  let files = $derived(getFiles());
  let hwAccel = $derived(getHwAccel());
  let converting = $state(false);
  let dragging = $state(false);
  let reduceMotion = $state(false);
  let expanded = $state<Record<number, boolean>>({});

  // Slide transition params, disabled when the user prefers reduced motion.
  let slideParams = $derived({ duration: reduceMotion ? 0 : 200, easing: cubicOut });

  let selectedCount = $derived(
    files.filter((f) => f.selected && f.status !== "converting" && f.status !== "complete").length,
  );
  let allSelected = $derived(
    files.some((f) => f.status !== "converting") &&
      files.filter((f) => f.status !== "converting").every((f) => f.selected),
  );

  let unlistenDrop: (() => void) | null = null;

  onMount(async () => {
    reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    loadHwAccel();
    try {
      const webview = getCurrentWebview();
      unlistenDrop = await webview.onDragDropEvent((event) => {
        const p = event.payload;
        if (p.type === "over") {
          dragging = true;
        } else if (p.type === "drop") {
          dragging = false;
          handleDroppedPaths(p.paths);
        } else {
          dragging = false;
        }
      });
    } catch {
      // drag-drop unavailable (e.g. in browser dev) — selection button still works
    }
  });

  onDestroy(() => unlistenDrop?.());

  async function loadHwAccel() {
    if (hwAccel) return;
    try {
      const info = await invoke<HwAccelInfo>("get_hwaccel_info");
      setHwAccel(info);
    } catch {
      // hardware acceleration detection is best-effort
    }
  }

  async function selectFiles() {
    const selected = await open({
      multiple: true,
      title: $t("convert.select_files"),
      filters: [{ name: "Media", extensions: MEDIA_EXT }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    await ingest(paths);
  }

  function handleDroppedPaths(paths: string[]) {
    const media = paths.filter((p) =>
      MEDIA_EXT.includes((p.split(".").pop() ?? "").toLowerCase()),
    );
    if (media.length === 0) return;
    ingest(media);
  }

  async function ingest(paths: string[]) {
    addFiles(paths);
    for (const path of paths) {
      const file = getFiles().find((f) => f.path === path);
      if (file && file.status === "idle") {
        await probeFile(file.id, path);
        extractThumb(file.id, path);
      }
    }
  }

  async function probeFile(id: number, path: string) {
    markFileProbing(id);
    try {
      const info = await invoke<ProbeInfo>("convert_probe_file", { path });
      updateFileProbe(id, info);
    } catch (e: any) {
      showToast("error", typeof e === "string" ? e : e?.message ?? $t("convert.probe_failed"));
    }
  }

  async function extractThumb(id: number, path: string) {
    try {
      const data = await invoke<string | null>("convert_extract_thumbnail", { path, atSeconds: 1.0 });
      setThumbnail(id, data ?? null);
    } catch {
      setThumbnail(id, null);
    }
  }

  function hasVideo(probe?: ProbeInfo) {
    return probe?.streams.some((s) => s.codec_type === "video");
  }
  function videoStream(probe: ProbeInfo) {
    return probe.streams.find((s) => s.codec_type === "video");
  }
  function audioStream(probe: ProbeInfo) {
    return probe.streams.find((s) => s.codec_type === "audio");
  }

  // ---- codec resolution: (selection + HW toggle + detected encoders) → ffmpeg encoder ----
  function hwEncoderFor(family: "h264" | "hevc"): string | null {
    const order =
      family === "h264"
        ? ["h264_videotoolbox", "h264_nvenc", "h264_qsv", "h264_amf", "h264_vaapi"]
        : ["hevc_videotoolbox", "hevc_nvenc", "hevc_qsv", "hevc_amf", "hevc_vaapi"];
    const enc = hwAccel?.encoders ?? [];
    return order.find((e) => enc.includes(e)) ?? null;
  }

  // Containers that can hold H.264 (so "auto" can map to the hardware H.264 encoder).
  function isH264Container(fmt: string): boolean {
    return ["mp4", "mkv", "mov", "m4v"].includes(fmt);
  }

  // Whether the hardware-acceleration toggle is meaningful for these options.
  function hwSupported(o: ConvertFile["options"]): boolean {
    if (o.videoCodec === "h264") return hwEncoderFor("h264") !== null;
    if (o.videoCodec === "h265") return hwEncoderFor("hevc") !== null;
    if (o.videoCodec === "auto")
      return hwEncoderFor("h264") !== null && isH264Container(o.outputFormat);
    return false;
  }

  function resolveVideoEncoder(o: ConvertFile["options"]): string | null {
    switch (o.videoCodec) {
      case "auto":
        return o.hwAccel && isH264Container(o.outputFormat)
          ? hwEncoderFor("h264")
          : null;
      case "copy":
        return "copy";
      case "h264":
        return o.hwAccel ? (hwEncoderFor("h264") ?? "libx264") : "libx264";
      case "h265":
        return o.hwAccel ? (hwEncoderFor("hevc") ?? "libx265") : "libx265";
      case "vp9":
        return "libvpx-vp9";
      case "av1":
        return "libaom-av1";
      default:
        return null;
    }
  }

  function resolveAudioEncoder(o: ConvertFile["options"]): string | null {
    const map: Record<string, string> = {
      aac: "aac",
      mp3: "libmp3lame",
      opus: "libopus",
      flac: "flac",
      copy: "copy",
    };
    return o.audioCodec === "auto" ? null : (map[o.audioCodec] ?? null);
  }

  function dirOf(path: string): string {
    const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    return idx >= 0 ? path.slice(0, idx) : ".";
  }

  type VideoFamily = "x264" | "x265" | "vp9" | "av1" | "vtb-h264" | "vtb-hevc" | "other";
  function videoFamily(venc: string | null): VideoFamily {
    if (!venc) return "other";
    if (venc === "libx264") return "x264";
    if (venc === "libx265") return "x265";
    if (venc === "libvpx-vp9") return "vp9";
    if (venc === "libaom-av1") return "av1";
    if (venc.includes("h264") && venc.includes("videotoolbox")) return "vtb-h264";
    if (venc.includes("hevc") && venc.includes("videotoolbox")) return "vtb-hevc";
    return "other";
  }
  // CRF (constant quality) value per software encoder family and quality tier.
  function crfFor(fam: VideoFamily, q: string): number | null {
    const table: Record<string, Record<string, number>> = {
      x264: { high: 18, std: 23, small: 28 },
      x265: { high: 20, std: 25, small: 30 },
      vp9: { high: 28, std: 33, small: 38 },
      av1: { high: 25, std: 32, small: 38 },
    };
    return table[fam]?.[q] ?? null;
  }
  // VideoToolbox constant-quality value (higher = better).
  function qvFor(q: string): number {
    return q === "high" ? 65 : q === "small" ? 35 : 50;
  }
  // Encoding-speed preset only applies to software x264/x265.
  function usesPreset(file: ConvertFile): boolean {
    const fam = videoFamily(resolveVideoEncoder(file.options));
    return fam === "x264" || fam === "x265";
  }

  const AUDIO_ONLY_FORMATS = ["mp3", "wav", "flac", "aac", "ogg", "opus", "m4a"];

  function buildBackendOptions(file: ConvertFile) {
    const o = file.options;
    const venc = resolveVideoEncoder(o);
    const fam = videoFamily(venc);
    const extraOut: string[] = [];
    let videoBitrate: string | null = null;

    // No video encoding for audio-only inputs or audio output containers.
    const wantVideo =
      hasVideo(file.probe) && !AUDIO_ONLY_FORMATS.includes(o.outputFormat);

    if (o.videoCodec !== "copy" && wantVideo) {
      if (o.rateMode === "size") {
        videoBitrate = o.videoBitrate ? `${o.videoBitrate}k` : null;
      } else {
        const crf = crfFor(fam, o.quality);
        if (crf !== null) {
          extraOut.push("-crf", String(crf));
          if (fam === "vp9" || fam === "av1") extraOut.push("-b:v", "0"); // CRF mode
        } else if (fam === "vtb-h264" || fam === "vtb-hevc") {
          extraOut.push("-q:v", String(qvFor(o.quality)));
        }
        // fam === "other" (auto): let the encoder use its own default quality
      }
    }

    if (o.channels) extraOut.push("-ac", o.channels);

    return {
      input_path: file.path,
      output_path: `${dirOf(file.path)}/${file.outputName}`,
      video_codec: wantVideo ? venc : null,
      audio_codec: resolveAudioEncoder(o),
      resolution: o.resolution === "original" ? null : o.resolution || null,
      video_bitrate: videoBitrate,
      audio_bitrate: o.audioBitrate ? `${o.audioBitrate}k` : null,
      sample_rate: o.sampleRate ? parseInt(o.sampleRate, 10) : null,
      fps: o.fps ? parseFloat(o.fps) : null,
      trim_start: o.trimStart || null,
      trim_end: o.trimEnd || null,
      additional_input_args: null,
      additional_output_args: extraOut.length ? extraOut : null,
      preset: wantVideo && usesPreset(file) && o.preset !== "medium" ? o.preset || null : null,
    };
  }

  async function startConversion() {
    const queue = files.filter(
      (f) => f.selected && (f.status === "ready" || f.status === "idle"),
    );
    if (queue.length === 0) return;
    converting = true;

    for (const file of queue) {
      if (!converting) break;
      try {
        const conversionId = await invoke<number>("convert_start", {
          options: buildBackendOptions(file),
          durationSeconds: file.probe?.duration_seconds ?? null,
        });
        markFileConverting(file.id, conversionId);
        await waitForConversion(conversionId);
      } catch (e: any) {
        showToast("error", typeof e === "string" ? e : e?.message ?? $t("convert.conversion_failed"));
      }
    }
    converting = false;
  }

  function waitForConversion(conversionId: number): Promise<void> {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const current = getFiles().find((f) => f.conversionId === conversionId);
        if (!current || current.status === "complete" || current.status === "error") {
          clearInterval(interval);
          resolve();
        }
      }, 400);
    });
  }

  async function handleCancel() {
    converting = false;
    const active = files.find((f) => f.status === "converting");
    if (active?.conversionId !== undefined) {
      try {
        await invoke("convert_cancel", { conversionId: active.conversionId });
      } catch {
        // already finished
      }
    }
  }

  async function openFolder(path?: string) {
    if (!path) return;
    try {
      const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
      await revealItemInDir(path);
    } catch {
      showToast("error", $t("convert.open_folder_failed"));
    }
  }

  function toggle(id: number) {
    expanded = { ...expanded, [id]: !expanded[id] };
  }

  let advOpen = $state<Record<number, boolean>>({});
  function toggleAdv(id: number) {
    advOpen = { ...advOpen, [id]: !advOpen[id] };
  }

  // ---- formatting + estimate ----
  function fmtDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  function fmtSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  function fmtEta(seconds?: number): string {
    if (seconds === undefined || seconds < 0) return "";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }

  // Bitrate multiplier relative to H.264 for comparable quality (newer codecs pack smaller).
  function codecEfficiency(codec: string): number {
    switch (codec) {
      case "h265":
        return 0.55;
      case "vp9":
        return 0.6;
      case "av1":
        return 0.5;
      default:
        return 1.0; // h264 / auto / hw
    }
  }

  // Heuristic target video bitrate (kbps) from resolution × fps × codec efficiency,
  // used when no explicit bitrate is set so the estimate still reacts to codec/resolution.
  function targetVideoKbps(file: ConvertFile): number {
    const vs = file.probe ? videoStream(file.probe) : undefined;
    let w = vs?.width ?? 1280;
    let h = vs?.height ?? 720;
    if (file.options.resolution !== "original" && file.options.resolution) {
      const [rw, rh] = file.options.resolution.split("x").map(Number);
      if (rw && rh) {
        w = rw;
        h = rh;
      }
    }
    let fps = vs?.fps ?? 30;
    const ofps = parseFloat(file.options.fps);
    if (ofps) fps = ofps;
    const qf =
      file.options.quality === "high" ? 1.4 : file.options.quality === "small" ? 0.6 : 1.0;
    // Encoding speed affects compression efficiency at constant quality
    // (slower = smaller), but only for software x264/x265.
    const pf = usesPreset(file)
      ? file.options.preset === "veryfast"
        ? 1.15
        : file.options.preset === "slow"
          ? 0.88
          : 1.0
      : 1.0;
    const BPP = 0.09; // bits per pixel per frame at ~standard quality
    return ((w * h * fps * BPP) / 1000) * codecEfficiency(file.options.videoCodec) * qf * pf;
  }

  // Estimated output size in bytes. Exact when a bitrate is set, otherwise a heuristic
  // that still reflects codec / resolution / fps changes.
  function estimateBytes(file: ConvertFile): number | null {
    const dur = file.probe?.duration_seconds ?? 0;
    if (!dur) return null;
    if (file.options.videoCodec === "copy") return file.probe?.file_size_bytes ?? null;
    let vbr = 0;
    if (hasVideo(file.probe)) {
      vbr =
        file.options.rateMode === "size"
          ? parseFloat(file.options.videoBitrate) || targetVideoKbps(file)
          : targetVideoKbps(file);
    }
    const abr = parseFloat(file.options.audioBitrate) || 192; // kbps
    return ((vbr + abr) * 1000 * dur) / 8;
  }
  function deltaPct(file: ConvertFile, est: number): number {
    const orig = file.probe?.file_size_bytes ?? 0;
    if (!orig) return 0;
    return Math.round((1 - est / orig) * 100);
  }

  function hwHint(file: ConvertFile): string {
    if (!hwSupported(file.options)) return $t("convert.hwaccel_unavailable");
    const enc =
      file.options.videoCodec === "h265" ? hwEncoderFor("hevc") : hwEncoderFor("h264");
    return $t("convert.hwaccel_will_use", { encoder: enc ?? "" });
  }
</script>

<div class="convert">
  <div class="page-head">
    <h1 class="page-title">{$t("convert.title")}</h1>
    {#if hwAccel}
      <span class="hw-pill" class:none={!hwAccel.recommended_video_encoder}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        {hwAccel.recommended_video_encoder
          ? $t("convert.hwaccel_detected", { encoder: hwAccel.recommended_video_encoder })
          : $t("convert.hwaccel_none")}
      </span>
    {/if}
  </div>

  {#if files.length === 0}
    <div
      class="dropzone"
      class:drag={dragging}
      role="button"
      tabindex="0"
      onclick={selectFiles}
      onkeydown={(e) => (e.key === "Enter" || e.key === " ") && selectFiles()}
    >
      <svg class="dz-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>
      </svg>
      <div class="dz-title">{$t("convert.drop_title")}</div>
      <div class="dz-sub">{$t("convert.drop_sub")} <ContextHint text={$t("hints.convert")} dismissKey="convert" /></div>
      <button class="btn" onclick={(e) => { e.stopPropagation(); selectFiles(); }}>{$t("convert.select_files")}</button>
    </div>
  {:else}
    <div class="list-head" class:drag={dragging}>
      <label class="sel-all">
        <input type="checkbox" class="ck" checked={allSelected} onchange={(e) => setAllSelected((e.target as HTMLInputElement).checked)} />
        <span>{$t("convert.select_all")}</span>
      </label>
      <h5>{$t("convert.file_count", { count: files.length })}</h5>
      <span class="sp"></span>
      <button class="btn sm ghost" onclick={selectFiles}>{$t("convert.add_files")}</button>
      <button class="btn sm ghost clear" onclick={clearFiles}>{$t("convert.clear_all")}</button>
    </div>

    <div class="files">
      {#each files as file (file.id)}
        <div class="file" class:sel={file.selected} class:open={expanded[file.id]}>
          <div class="file-main">
            <input
              type="checkbox"
              class="ck"
              checked={file.selected}
              disabled={file.status === "converting"}
              onchange={(e) => setSelected(file.id, (e.target as HTMLInputElement).checked)}
            />

            <div class="thumb" class:audio={!file.thumbnail}>
              {#if file.thumbnail}
                <img src={file.thumbnail} alt="" />
                {#if file.probe && file.probe.duration_seconds > 0}
                  <span class="dur">{fmtDuration(file.probe.duration_seconds)}</span>
                {/if}
              {:else}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              {/if}
            </div>

            <div class="finfo">
              <span class="fname">{file.name}</span>
              {#if file.status === "probing"}
                <div class="fmeta"><span class="muted">{$t("convert.status_probing")}</span></div>
              {:else if file.probe}
                {@const vs = videoStream(file.probe)}
                {@const as_ = audioStream(file.probe)}
                <div class="fmeta">
                  {#if vs?.width && vs?.height}<span class="tag">{vs.width}×{vs.height}</span>{/if}
                  {#if vs?.fps}<span class="tag">{Math.round(vs.fps)} fps</span>{/if}
                  {#if vs}<span class="tag vc">{vs.codec_name.toUpperCase()}</span>{/if}
                  {#if as_}<span class="tag ac">{as_.codec_name.toUpperCase()}{as_.channels ? ` · ${as_.channels}ch` : ""}</span>{/if}
                  <span class="tag">{fmtSize(file.probe.file_size_bytes)}</span>
                  {#if file.probe.bit_rate > 0}<span class="tag">{(file.probe.bit_rate / 1_000_000).toFixed(1)} Mbps</span>{/if}
                </div>
              {/if}
            </div>

            {#if file.status === "ready" || file.status === "idle"}
              <span class="badge ready"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/></svg>{$t("convert.status_ready")}</span>
            {:else if file.status === "converting"}
              <span class="badge run"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.2-8.5"/></svg>{$t("convert.status_converting")}</span>
            {:else if file.status === "complete"}
              <span class="badge done"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>{$t("convert.status_complete")}</span>
            {:else if file.status === "error"}
              <span class="badge err"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12" y2="16"/><circle cx="12" cy="12" r="9"/></svg>{$t("convert.status_error")}</span>
            {/if}

            {#if file.status !== "converting" && file.status !== "complete"}
              <button class="icon-btn" aria-label={$t("convert.options_title")} onclick={() => toggle(file.id)}>
                <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            {/if}
            {#if file.status !== "converting"}
              <button class="icon-btn danger" aria-label={$t("convert.remove")} onclick={() => removeFile(file.id)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            {/if}
          </div>

          {#if file.status === "converting"}
            <div class="prog-wrap">
              <div class="prog-line">
                <span><span class="pct">{file.percent.toFixed(0)}%</span></span>
                <span>
                  {#if file.speed}{file.speed.toFixed(1)}× · {/if}
                  {#if file.etaSeconds !== undefined}{$t("convert.eta", { time: fmtEta(file.etaSeconds) })}{/if}
                </span>
              </div>
              <div class="bar"><i style="width: {file.percent}%"></i></div>
            </div>
          {:else if file.status === "complete"}
            <div class="done-row">
              <span class="out">{file.outputName}{#if file.outputSize} · {fmtSize(file.outputSize)}{/if}</span>
              <button class="btn sm ghost" onclick={() => openFolder(file.outputPath)}>{$t("convert.open_folder")}</button>
              <button class="btn sm" onclick={() => resetForReconvert(file.id)}>{$t("convert.reconvert")}</button>
            </div>
          {:else if file.status === "error"}
            <div class="done-row">
              <span class="out err">{file.error}</span>
              <button class="btn sm" onclick={() => resetForReconvert(file.id)}>{$t("convert.reconvert")}</button>
            </div>
          {/if}

          {#if expanded[file.id] && (file.status === "ready" || file.status === "idle")}
            {@const est = estimateBytes(file)}
            <div class="opt-panel" transition:slide={slideParams}>
              {#if ["auto", "h264", "h265"].includes(file.options.videoCodec)}
                <div class="hw-row">
                  <div class="hw-l">
                    <span class="hw-t">{$t("convert.hwaccel_toggle")}</span>
                    <span class="hw-d">{hwHint(file)}</span>
                  </div>
                  <input
                    type="checkbox"
                    class="sw"
                    checked={file.options.hwAccel && hwSupported(file.options)}
                    disabled={!hwSupported(file.options)}
                    onchange={(e) => updateFileOptions(file.id, { hwAccel: (e.target as HTMLInputElement).checked })}
                  />
                </div>
              {/if}

              <div class="opt-grid">
                <div class="opt">
                  <label for="of-{file.id}">{$t("convert.output_format")}</label>
                  <select id="of-{file.id}" class="ctrl" value={file.options.outputFormat} onchange={(e) => updateFileOptions(file.id, { outputFormat: (e.target as HTMLSelectElement).value })}>
                    <option value="mp4">MP4</option><option value="mkv">MKV</option><option value="webm">WebM</option>
                    <option value="mov">MOV</option><option value="avi">AVI</option>
                    <option value="mp3">MP3</option><option value="m4a">M4A</option><option value="wav">WAV</option>
                    <option value="flac">FLAC</option><option value="aac">AAC</option><option value="opus">Opus</option>
                  </select>
                </div>
                <div class="opt">
                  <label for="vc-{file.id}">{$t("convert.video_codec")}</label>
                  <select id="vc-{file.id}" class="ctrl" value={file.options.videoCodec} onchange={(e) => updateFileOptions(file.id, { videoCodec: (e.target as HTMLSelectElement).value })}>
                    <option value="auto">{$t("convert.auto")}</option>
                    <option value="h264">H.264</option>
                    <option value="h265">H.265 (HEVC)</option>
                    <option value="vp9">VP9</option>
                    <option value="av1">AV1</option>
                    <option value="copy">{$t("convert.codec_copy")}</option>
                  </select>
                </div>
              </div>

              <div class="opt-grid">
                <div class="opt">
                  <label for="ac-{file.id}">{$t("convert.audio_codec")}</label>
                  <select id="ac-{file.id}" class="ctrl" value={file.options.audioCodec} onchange={(e) => updateFileOptions(file.id, { audioCodec: (e.target as HTMLSelectElement).value })}>
                    <option value="auto">{$t("convert.auto")}</option>
                    <option value="aac">AAC</option><option value="mp3">MP3</option>
                    <option value="opus">Opus</option><option value="flac">FLAC</option>
                    <option value="copy">{$t("convert.codec_copy")}</option>
                  </select>
                </div>
                <div class="opt">
                  <label for="res-{file.id}">{$t("convert.resolution")}</label>
                  <select id="res-{file.id}" class="ctrl" value={file.options.resolution} onchange={(e) => updateFileOptions(file.id, { resolution: (e.target as HTMLSelectElement).value })}>
                    <option value="original">{$t("convert.original")}</option>
                    <option value="3840x2160">4K (2160p)</option>
                    <option value="1920x1080">1080p</option>
                    <option value="1280x720">720p</option>
                    <option value="854x480">480p</option>
                    <option value="640x360">360p</option>
                  </select>
                </div>
              </div>

              <div class="rate-head">
                <span class="rate-lbl">{$t("convert.rate_mode")}</span>
                <div class="seg" role="group" aria-label={$t("convert.rate_mode") as string}>
                  <button type="button" class:active={file.options.rateMode === "quality"} onclick={() => updateFileOptions(file.id, { rateMode: "quality" })}>{$t("convert.rate_quality")}</button>
                  <button type="button" class:active={file.options.rateMode === "size"} onclick={() => updateFileOptions(file.id, { rateMode: "size" })}>{$t("convert.rate_size")}</button>
                </div>
              </div>
              <div class="opt-grid">
                {#if file.options.rateMode === "quality"}
                  <div class="opt">
                    <label for="q-{file.id}">{$t("convert.video_quality")}</label>
                    <select id="q-{file.id}" class="ctrl" value={file.options.quality} onchange={(e) => updateFileOptions(file.id, { quality: (e.target as HTMLSelectElement).value as "high" | "std" | "small" })}>
                      <option value="high">{$t("convert.q_high")}</option>
                      <option value="std">{$t("convert.q_std")}</option>
                      <option value="small">{$t("convert.q_small")}</option>
                    </select>
                  </div>
                {:else}
                  <div class="opt">
                    <label for="vbr-{file.id}">{$t("convert.video_bitrate")}</label>
                    <div class="field">
                      <input id="vbr-{file.id}" list="vbr-presets" inputmode="numeric" placeholder={$t("convert.bitrate_auto")} value={file.options.videoBitrate} oninput={(e) => updateFileOptions(file.id, { videoBitrate: (e.target as HTMLInputElement).value })} />
                      <span class="unit">kbps</span>
                    </div>
                  </div>
                {/if}
                <div class="opt">
                  <label for="spd-{file.id}">{$t("convert.enc_speed")}</label>
                  <select id="spd-{file.id}" class="ctrl" value={file.options.preset} disabled={!usesPreset(file)} title={usesPreset(file) ? "" : ($t("convert.enc_speed_na") as string)} onchange={(e) => updateFileOptions(file.id, { preset: (e.target as HTMLSelectElement).value })}>
                    <option value="veryfast">{$t("convert.q_fast")}</option>
                    <option value="medium">{$t("convert.q_std")}</option>
                    <option value="slow">{$t("convert.speed_slow")}</option>
                  </select>
                </div>
              </div>

              <div class="opt-grid">
                <div class="opt">
                  <label for="abr-{file.id}">{$t("convert.audio_bitrate")}</label>
                  <select id="abr-{file.id}" class="ctrl" value={file.options.audioBitrate} onchange={(e) => updateFileOptions(file.id, { audioBitrate: (e.target as HTMLSelectElement).value })}>
                    <option value="">{$t("convert.bitrate_auto")}</option>
                    <option value="128">128 kbps</option><option value="192">192 kbps</option>
                    <option value="256">256 kbps</option><option value="320">320 kbps</option>
                  </select>
                </div>
                <div class="opt">
                  <label for="fps-{file.id}">{$t("convert.fps")}</label>
                  <div class="field">
                    <input id="fps-{file.id}" list="fps-presets" inputmode="decimal" placeholder={$t("convert.original")} value={file.options.fps} oninput={(e) => updateFileOptions(file.id, { fps: (e.target as HTMLInputElement).value })} />
                    <span class="unit">fps</span>
                  </div>
                </div>
              </div>

              <div class="opt-grid">
                <div class="opt full">
                  <label for="name-{file.id}">{$t("convert.output_name")}</label>
                  <input id="name-{file.id}" class="ctrl name" value={file.outputName} onchange={(e) => setOutputName(file.id, (e.target as HTMLInputElement).value)} />
                </div>
              </div>

              <button class="adv-toggle" onclick={() => toggleAdv(file.id)}>{advOpen[file.id] ? $t("convert.adv_hide") : $t("convert.adv_show")}</button>
              {#if advOpen[file.id]}
                <div class="opt-grid" transition:slide={slideParams}>
                  <div class="opt">
                    <label for="ts-{file.id}">{$t("convert.trim_start")}</label>
                    <input id="ts-{file.id}" class="ctrl" placeholder="00:00:00" value={file.options.trimStart} onchange={(e) => updateFileOptions(file.id, { trimStart: (e.target as HTMLInputElement).value })} />
                  </div>
                  <div class="opt">
                    <label for="te-{file.id}">{$t("convert.trim_end")}</label>
                    <input id="te-{file.id}" class="ctrl" placeholder="00:00:00" value={file.options.trimEnd} onchange={(e) => updateFileOptions(file.id, { trimEnd: (e.target as HTMLInputElement).value })} />
                  </div>
                  <div class="opt">
                    <label for="sr-{file.id}">{$t("convert.sample_rate")}</label>
                    <select id="sr-{file.id}" class="ctrl" value={file.options.sampleRate} onchange={(e) => updateFileOptions(file.id, { sampleRate: (e.target as HTMLSelectElement).value })}>
                      <option value="">{$t("convert.original")}</option>
                      <option value="48000">48 kHz</option><option value="44100">44.1 kHz</option>
                    </select>
                  </div>
                  <div class="opt">
                    <label for="ch-{file.id}">{$t("convert.channels")}</label>
                    <select id="ch-{file.id}" class="ctrl" value={file.options.channels} onchange={(e) => updateFileOptions(file.id, { channels: (e.target as HTMLSelectElement).value })}>
                      <option value="">{$t("convert.original")}</option>
                      <option value="2">{$t("convert.ch_stereo")}</option>
                      <option value="1">{$t("convert.ch_mono")}</option>
                    </select>
                  </div>
                </div>
              {/if}

              <div class="estimate">
                <span class="lab">{$t("convert.est_size")}</span>
                {#if est === null}
                  <span class="val muted">—</span>
                {:else}
                  {@const d = deltaPct(file, est)}
                  <span class="est-right">
                    <span class="delta" class:down={d >= 0} class:up={d < 0}>{d >= 0 ? "↓" : "↑"} {Math.abs(d)}%</span>
                    <span class="val">≈ {fmtSize(est)}</span>
                  </span>
                {/if}
              </div>

              {#if files.length > 1}
                <button class="apply-all" onclick={() => applyOptionsToAll(file.id)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  {$t("convert.apply_to_all")}
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <datalist id="vbr-presets"><option value="2500"></option><option value="5000"></option><option value="8000"></option><option value="12000"></option><option value="20000"></option></datalist>
    <datalist id="fps-presets"><option value="24"></option><option value="25"></option><option value="30"></option><option value="50"></option><option value="60"></option></datalist>

    <div class="action-bar">
      <span class="sp"></span>
      {#if converting}
        <button class="btn cancel" onclick={handleCancel}>{$t("convert.cancel")}</button>
      {:else}
        <button class="btn primary" onclick={startConversion} disabled={selectedCount === 0}>
          {selectedCount > 0 ? $t("convert.convert_n", { count: selectedCount }) : $t("convert.convert_btn")}
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .convert { display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 28px var(--padding) 64px; }
  .convert > * { width: 100%; max-width: 680px; }

  .page-head { display: flex; align-items: center; gap: 12px; }
  .page-title { font-size: 24px; font-weight: 500; margin: 0; }
  .hw-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 500; padding: 5px 11px; border-radius: 999px; color: var(--green); background: color-mix(in srgb, var(--green) 16%, transparent); }
  .hw-pill.none { color: var(--gray); background: var(--button-elevated); }
  .hw-pill svg { width: 14px; height: 14px; flex-shrink: 0; }

  .dropzone { border: 2px dashed var(--input-border); border-radius: 14px; background: var(--button); display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; padding: 44px 24px; cursor: pointer; transition: border-color var(--duration-base) var(--ease-out), background var(--duration-base) var(--ease-out); }
  .dropzone:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
  .dropzone.drag { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
  @media (hover: hover) { .dropzone:hover { border-color: var(--accent); background: var(--button-hover); } }
  .dz-icon { width: 46px; height: 46px; color: var(--tertiary); }
  .dropzone.drag .dz-icon { color: var(--accent); }
  .dz-title { font-size: 15px; font-weight: 600; color: var(--secondary); }
  .dz-sub { font-size: 13px; color: var(--gray); max-width: 360px; line-height: 1.5; }

  .list-head { display: flex; align-items: center; gap: 12px; border-radius: var(--border-radius); transition: background var(--duration-base) var(--ease-out); }
  .list-head.drag { background: color-mix(in srgb, var(--accent) 10%, transparent); outline: 2px dashed var(--accent); outline-offset: 4px; }
  .list-head h5 { font-size: 13px; font-weight: 600; color: var(--gray); margin: 0; }
  .list-head .sp { flex: 1; }
  .sel-all { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 500; color: var(--gray); cursor: pointer; user-select: none; }

  .ck { appearance: none; width: 19px; height: 19px; flex-shrink: 0; border: 2px solid var(--input-border); border-radius: 6px; background: var(--input-bg); cursor: pointer; position: relative; transition: var(--duration-fast); }
  .ck:checked { background: var(--accent); border-color: var(--accent); }
  .ck:checked::after { content: ""; position: absolute; left: 5px; top: 1px; width: 5px; height: 10px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg); }
  .ck:disabled { opacity: 0.4; cursor: default; }
  .ck:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }

  .files { display: flex; flex-direction: column; gap: 10px; }
  .file { background: var(--button); border: 1px solid var(--button-stroke); border-radius: var(--border-radius); overflow: hidden; transition: border-color var(--duration-base) var(--ease-out); }
  .file.sel { border-color: var(--accent); }
  .file-main { display: flex; align-items: center; gap: 13px; padding: 12px 14px; }

  .thumb { position: relative; width: 104px; height: 60px; flex-shrink: 0; border-radius: 8px; overflow: hidden; background: #000; display: flex; align-items: center; justify-content: center; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
  .thumb.audio { background: var(--button-elevated); color: var(--gray); }
  .thumb.audio svg { width: 26px; height: 26px; }
  .thumb .dur { position: absolute; right: 4px; bottom: 4px; font-family: var(--font-mono); font-size: 10.5px; color: #fff; background: rgba(0,0,0,0.72); padding: 1px 5px; border-radius: 4px; font-variant-numeric: tabular-nums; }

  .finfo { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .fname { font-size: 14.5px; font-weight: 600; color: var(--secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fmeta { display: flex; flex-wrap: wrap; gap: 5px 4px; font-size: 12px; color: var(--gray); font-variant-numeric: tabular-nums; }
  .fmeta .muted { font-style: italic; }
  .tag { display: inline-flex; align-items: center; background: var(--button-elevated); border-radius: 5px; padding: 1px 7px; font-weight: 500; }
  .tag.vc { color: var(--accent); }

  .badge { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; padding: 3px 9px; border-radius: 999px; flex-shrink: 0; }
  .badge svg { width: 13px; height: 13px; }
  .badge.ready { color: var(--gray); background: var(--button-elevated); }
  .badge.run { color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); }
  .badge.done { color: var(--green); background: color-mix(in srgb, var(--green) 16%, transparent); }
  .badge.err { color: var(--red); background: color-mix(in srgb, var(--red) 14%, transparent); }

  .icon-btn { width: 30px; height: 30px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border: none; background: transparent; color: var(--gray); border-radius: 7px; cursor: pointer; transition: var(--duration-fast); }
  .icon-btn svg { width: 17px; height: 17px; pointer-events: none; }
  @media (hover: hover) { .icon-btn:hover { background: var(--button-elevated); color: var(--secondary); } .icon-btn.danger:hover { color: var(--red); } }
  .icon-btn:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
  .chev { transition: transform var(--duration-base) var(--ease-out); }
  .file.open .chev { transform: rotate(180deg); }

  .prog-wrap { padding: 0 14px 13px; display: flex; flex-direction: column; gap: 7px; }
  .prog-line { display: flex; justify-content: space-between; font-size: 12px; color: var(--gray); font-variant-numeric: tabular-nums; }
  .prog-line .pct { color: var(--accent); font-weight: 600; }
  .bar { height: 7px; background: var(--button-elevated); border-radius: 4px; overflow: hidden; }
  .bar > i { display: block; height: 100%; background: var(--accent); border-radius: 4px; transition: width var(--duration-slow) var(--ease-out); }

  .done-row { display: flex; align-items: center; gap: 9px; padding: 0 14px 13px; flex-wrap: wrap; }
  .done-row .out { font-size: 12.5px; color: var(--gray); font-variant-numeric: tabular-nums; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .done-row .out.err { color: var(--red); white-space: normal; }

  /* NB: do not name this `.settings` — a global `.settings` rule (settings.css, imported in
     app.css) sets min-height:100vh and would stretch this panel, leaving dead space. */
  .opt-panel { border-top: 1px solid var(--button-stroke); background: color-mix(in srgb, var(--button) 60%, var(--primary)); padding: 14px; display: flex; flex-direction: column; gap: 13px; }
  .opt-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .opt { display: flex; flex-direction: column; gap: 5px; }
  .opt.full { grid-column: 1 / -1; }
  .opt label { font-size: 11.5px; font-weight: 600; color: var(--gray); text-align: center; }

  .rate-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .rate-lbl { font-size: 11.5px; font-weight: 600; color: var(--gray); }
  .seg { display: inline-flex; background: var(--button-elevated); border-radius: 8px; padding: 2px; gap: 2px; }
  .seg button { font-family: inherit; font-size: 12.5px; font-weight: 600; color: var(--gray); background: transparent; border: none; border-radius: 6px; padding: 6px 14px; cursor: pointer; transition: var(--duration-fast); }
  .seg button.active { background: var(--accent); color: var(--on-accent); }
  @media (hover: hover) { .seg button:not(.active):hover { color: var(--secondary); } }
  .seg button:focus-visible { outline: var(--focus-ring); outline-offset: 1px; }
  .ctrl:disabled { opacity: 0.45; cursor: not-allowed; }

  .ctrl { font-family: inherit; font-size: 13.5px; font-weight: 500; color: var(--secondary); background: var(--button-elevated); border: 1px solid transparent; border-radius: 8px; height: 40px; padding: 0 26px; width: 100%; text-align: center; text-align-last: center; cursor: pointer; transition: var(--duration-fast); appearance: none; -webkit-appearance: none; }
  select.ctrl { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23999" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'); background-repeat: no-repeat; background-position: right 9px center; background-size: 13px; }
  input.ctrl { cursor: text; font-variant-numeric: tabular-nums; }
  input.ctrl.name { text-align: left; text-align-last: left; padding: 0 12px; }
  /* background-color (not the `background` shorthand) so the select arrow image survives hover */
  @media (hover: hover) { .ctrl:hover { background-color: var(--button-elevated-hover); } }
  .ctrl:focus, .ctrl:focus-visible { outline: var(--focus-ring); outline-offset: 1px; border-color: var(--accent); }

  .field { position: relative; display: flex; align-items: center; height: 40px; width: 100%; background: var(--button-elevated); border: 1px solid transparent; border-radius: 8px; overflow: hidden; transition: var(--duration-fast); }
  @media (hover: hover) { .field:hover { background-color: var(--button-elevated-hover); } }
  .field:focus-within { outline: var(--focus-ring); outline-offset: 1px; border-color: var(--accent); }
  /* symmetric padding keeps the number centered like the other fields; the unit is overlaid on the right */
  .field input { flex: 1; min-width: 0; width: 100%; border: none; background: transparent; height: 100%; outline: none; font-family: inherit; font-size: 13.5px; font-weight: 500; color: var(--secondary); text-align: center; font-variant-numeric: tabular-nums; padding: 0 38px; }
  .field input::placeholder { color: var(--gray); font-weight: 500; }
  .field .unit { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font-size: 11px; font-weight: 600; color: var(--gray); pointer-events: none; }

  .hw-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: var(--button-elevated); border-radius: 8px; padding: 10px 12px; }
  .hw-l { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .hw-t { font-size: 13px; font-weight: 600; color: var(--secondary); }
  .hw-d { font-size: 11.5px; color: var(--gray); }
  .sw { appearance: none; position: relative; width: 40px; height: 23px; border-radius: 999px; background: var(--input-border); cursor: pointer; flex-shrink: 0; transition: background var(--duration-base); }
  .sw:checked { background: var(--accent); }
  .sw::after { content: ""; position: absolute; top: 2px; left: 2px; width: 19px; height: 19px; border-radius: 50%; background: #fff; transition: transform var(--duration-base); }
  .sw:checked::after { transform: translateX(17px); }
  .sw:disabled { opacity: 0.4; cursor: not-allowed; }
  .sw:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }

  .estimate { display: flex; align-items: center; justify-content: space-between; gap: 10px; border-top: 1px dashed var(--button-stroke); padding-top: 12px; font-size: 13px; }
  .estimate .lab { color: var(--gray); font-weight: 500; }
  .est-right { display: flex; align-items: center; gap: 9px; }
  .estimate .val { font-family: var(--font-mono); font-weight: 600; font-variant-numeric: tabular-nums; color: var(--secondary); font-size: 14px; }
  .estimate .val.muted { color: var(--gray); font-size: 12.5px; }
  .delta { font-size: 11.5px; font-weight: 600; padding: 2px 7px; border-radius: 5px; }
  .delta.down { color: var(--green); background: color-mix(in srgb, var(--green) 16%, transparent); }
  .delta.up { color: var(--warning); background: color-mix(in srgb, var(--warning) 16%, transparent); }

  .adv-toggle { font-size: 12px; font-weight: 600; color: var(--accent); background: none; border: none; cursor: pointer; align-self: center; padding: 2px 6px; }
  .apply-all { align-self: center; display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--accent); background: none; border: 1px solid var(--button-stroke); border-radius: 8px; padding: 8px 14px; cursor: pointer; transition: var(--duration-fast); }
  @media (hover: hover) { .apply-all:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); border-color: transparent; } }
  .apply-all svg { width: 14px; height: 14px; }

  .action-bar { position: sticky; bottom: 0; display: flex; align-items: center; gap: 12px; padding: 14px 0; }
  .action-bar .sp { flex: 1; }

  .btn { font-family: inherit; font-size: 14px; font-weight: 600; border-radius: var(--border-radius); padding: 11px 18px; cursor: pointer; border: 1px solid var(--button-stroke); background: var(--button); color: var(--secondary); transition: var(--duration-fast); }
  @media (hover: hover) { .btn:hover { background: var(--button-hover); } }
  .btn:active { transform: translateY(1px); }
  .btn:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
  .btn.sm { padding: 7px 13px; font-size: 12.5px; }
  .btn.ghost { background: transparent; }
  .btn.ghost.clear { color: var(--gray); }
  .btn.primary { background: var(--accent); color: var(--on-accent); border-color: transparent; padding: 11px 26px; }
  @media (hover: hover) { .btn.primary:hover { filter: brightness(1.06); } }
  .btn.primary:disabled { opacity: 0.45; cursor: not-allowed; filter: none; }
  .btn.cancel { color: var(--red); }
</style>
