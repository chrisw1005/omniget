// Bundled release notes for this fork, keyed by version.
// Shown in the About → Changelog tab and the update dialog without needing a
// network call. Markdown is rendered by the lightweight renderer in
// src/routes/about/changelog/+page.svelte (## / ### headings, - lists, **bold**,
// `code`, and [links](url)).

export const RELEASE_NOTES: Record<string, string> = {
  "0.8.0": `## OmniGet 0.8.0

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
};

export function localReleaseNotes(version: string): string {
  return RELEASE_NOTES[version] ?? "";
}
