export type FileStatus =
  | "idle"
  | "probing"
  | "ready"
  | "converting"
  | "complete"
  | "error";

export type StreamInfo = {
  index: number;
  codec_type: string;
  codec_name: string;
  codec_long_name: string;
  width?: number;
  height?: number;
  fps?: number;
  bit_rate?: number;
  sample_rate?: number;
  channels?: number;
  duration_seconds?: number;
};

export type ProbeInfo = {
  duration_seconds: number;
  format_name: string;
  format_long_name: string;
  file_size_bytes: number;
  bit_rate: number;
  streams: StreamInfo[];
};

// Per-file conversion settings.
export type ConvertOptions = {
  outputFormat: string;
  videoCodec: string; // "auto" | "h264" | "h265" | "vp9" | "av1" | "copy"
  hwAccel: boolean; // hardware acceleration toggle (VideoToolbox/NVENC/…)
  audioCodec: string;
  resolution: string; // "original" | "1920x1080" | …
  rateMode: "quality" | "size"; // target a quality level, or a file size (bitrate)
  quality: "high" | "std" | "small"; // quality tier (rateMode === "quality")
  preset: string; // encoding speed: "veryfast" | "medium" | "slow" (software encoders only)
  videoBitrate: string; // kbps, used when rateMode === "size"
  audioBitrate: string; // kbps, empty = auto
  fps: string; // empty = original
  sampleRate: string; // empty = original
  channels: string; // empty = original
  trimStart: string;
  trimEnd: string;
};

export type ConvertFile = {
  id: number;
  path: string;
  name: string;
  status: FileStatus;
  selected: boolean;
  probe?: ProbeInfo;
  thumbnail?: string | null; // base64 data URL; null = no frame (audio)
  options: ConvertOptions;
  outputName: string; // editable output filename (with extension)
  percent: number;
  speed?: number; // × real-time
  etaSeconds?: number;
  conversionId?: number;
  error?: string;
  outputPath?: string;
  outputSize?: number;
};

export type HwAccelInfo = {
  encoders: string[];
  decoders: string[];
  recommended_video_encoder: string | null;
  recommended_decoder: string | null;
};

const defaultOptions: ConvertOptions = {
  outputFormat: "mp4",
  videoCodec: "h264",
  hwAccel: true,
  audioCodec: "auto",
  resolution: "original",
  rateMode: "quality",
  quality: "std",
  preset: "medium",
  videoBitrate: "",
  audioBitrate: "",
  fps: "",
  sampleRate: "",
  channels: "",
  trimStart: "",
  trimEnd: "",
};

function deriveOutputName(srcName: string, fmt: string): string {
  const dot = srcName.lastIndexOf(".");
  const base = dot > 0 ? srcName.slice(0, dot) : srcName;
  return `${base}_converted.${fmt}`;
}

function swapExt(name: string, fmt: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}.${fmt}`;
}

let nextId = 1;
let files: ConvertFile[] = $state([]);
let hwAccel: HwAccelInfo | null = $state(null);

export function getFiles(): ConvertFile[] {
  return files;
}

export function getHwAccel(): HwAccelInfo | null {
  return hwAccel;
}

export function setHwAccel(info: HwAccelInfo) {
  hwAccel = info;
}

export function addFiles(paths: string[]) {
  for (const path of paths) {
    if (files.some((f) => f.path === path)) continue;
    const name = path.split(/[/\\]/).pop() ?? path;
    const options = { ...defaultOptions };
    files = [
      ...files,
      {
        id: nextId++,
        path,
        name,
        status: "idle",
        selected: true,
        options,
        outputName: deriveOutputName(name, options.outputFormat),
        percent: 0,
      },
    ];
  }
}

export function removeFile(id: number) {
  files = files.filter((f) => f.id !== id);
}

export function clearFiles() {
  files = [];
}

export function setSelected(id: number, selected: boolean) {
  files = files.map((f) => (f.id === id ? { ...f, selected } : f));
}

export function setAllSelected(selected: boolean) {
  files = files.map((f) =>
    f.status === "converting" ? f : { ...f, selected },
  );
}

export function markFileProbing(id: number) {
  files = files.map((f) =>
    f.id === id ? { ...f, status: "probing" as FileStatus } : f,
  );
}

export function updateFileProbe(id: number, probe: ProbeInfo) {
  files = files.map((f) =>
    f.id === id ? { ...f, probe, status: "ready" as FileStatus } : f,
  );
}

export function setThumbnail(id: number, thumbnail: string | null) {
  files = files.map((f) => (f.id === id ? { ...f, thumbnail } : f));
}

export function updateFileOptions(id: number, partial: Partial<ConvertOptions>) {
  files = files.map((f) => {
    if (f.id !== id) return f;
    const options = { ...f.options, ...partial };
    let outputName = f.outputName;
    if (
      partial.outputFormat &&
      partial.outputFormat !== f.options.outputFormat
    ) {
      outputName = swapExt(f.outputName, partial.outputFormat);
    }
    return { ...f, options, outputName };
  });
}

export function setOutputName(id: number, outputName: string) {
  files = files.map((f) => (f.id === id ? { ...f, outputName } : f));
}

// Copy one file's settings (not its output name) to every other file.
export function applyOptionsToAll(fromId: number) {
  const src = files.find((f) => f.id === fromId);
  if (!src) return;
  files = files.map((f) =>
    f.id === fromId || f.status === "converting"
      ? f
      : {
          ...f,
          options: { ...src.options },
          outputName: swapExt(f.outputName, src.options.outputFormat),
        },
  );
}

export function markFileConverting(id: number, conversionId: number) {
  files = files.map((f) =>
    f.id === id
      ? {
          ...f,
          status: "converting" as FileStatus,
          conversionId,
          percent: 0,
          speed: undefined,
          etaSeconds: undefined,
          error: undefined,
        }
      : f,
  );
}

export function updateFileProgress(
  conversionId: number,
  percent: number,
  speed?: number,
  etaSeconds?: number,
) {
  files = files.map((f) =>
    f.conversionId === conversionId ? { ...f, percent, speed, etaSeconds } : f,
  );
}

export function markFileComplete(
  conversionId: number,
  outputPath: string,
  outputSize: number,
) {
  files = files.map((f) =>
    f.conversionId === conversionId
      ? {
          ...f,
          status: "complete" as FileStatus,
          percent: 100,
          speed: undefined,
          etaSeconds: undefined,
          outputPath,
          outputSize,
        }
      : f,
  );
}

export function markFileError(conversionId: number, error: string) {
  files = files.map((f) =>
    f.conversionId === conversionId
      ? { ...f, status: "error" as FileStatus, error }
      : f,
  );
}

// Reset a finished/errored file so its settings can be edited and run again.
export function resetForReconvert(id: number) {
  files = files.map((f) =>
    f.id === id
      ? {
          ...f,
          status: "ready" as FileStatus,
          selected: true,
          percent: 0,
          speed: undefined,
          etaSeconds: undefined,
          conversionId: undefined,
          error: undefined,
          outputPath: undefined,
          outputSize: undefined,
        }
      : f,
  );
}
