// Shape of a single downloadable format as returned by the `get_media_formats`
// Tauri command. Shared between the omnibox download page and the LinkGrabber.
export type FormatInfo = {
  format_id: string;
  ext: string;
  resolution: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  vcodec: string | null;
  acodec: string | null;
  filesize: number | null;
  tbr: number | null;
  has_video: boolean;
  has_audio: boolean;
  format_note: string | null;
};
