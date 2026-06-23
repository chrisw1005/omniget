use tauri::{Emitter, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

use crate::storage::config;

pub fn reregister(app: &tauri::AppHandle) {
    if let Err(e) = app.global_shortcut().unregister_all() {
        tracing::warn!("Failed to unregister hotkeys: {}", e);
    }
    register_from_settings(app);
}

pub fn register_from_settings(app: &tauri::AppHandle) {
    let settings = config::load_settings(app);

    if settings.download.hotkey_enabled {
        register_one(app, &settings.download.hotkey_binding, "download");
    }
    if settings.download.clip_hotkey_enabled {
        register_one(app, &settings.download.clip_hotkey_binding, "clip");
    }
    if settings.download.music_hotkey_enabled {
        register_one(app, &settings.download.music_hotkey_binding, "music");
    }
}

fn register_one(app: &tauri::AppHandle, binding: &str, label: &str) {
    match binding.parse::<Shortcut>() {
        Ok(shortcut) => {
            if let Err(e) = app.global_shortcut().register(shortcut) {
                tracing::warn!("[hotkey] register {} '{}' failed: {}", label, binding, e);
                #[cfg(target_os = "macos")]
                {
                    tracing::warn!(
                        "[hotkey] macOS: Global shortcut registration failed. \
                        The app may need Accessibility permission. \
                        Go to System Settings > Privacy & Security > Accessibility \
                        and enable OmniGet."
                    );
                    let _ = app.emit(
                        "hotkey-permission-error",
                        serde_json::json!({
                            "message": "Global hotkey requires Accessibility permission. Open System Settings > Privacy & Security > Accessibility and enable OmniGet.",
                            "platform": "macos"
                        }),
                    );
                }
            } else {
                tracing::info!("[hotkey] registered {}: {}", label, binding);
            }
        }
        Err(e) => {
            tracing::warn!("[hotkey] invalid {} binding '{}': {:?}", label, binding, e);
        }
    }
}

pub fn on_hotkey_pressed(app: &tauri::AppHandle, shortcut: &Shortcut) {
    let settings = config::load_settings(app);

    let download_match = matches_binding(shortcut, &settings.download.hotkey_binding);
    let clip_match = matches_binding(shortcut, &settings.download.clip_hotkey_binding);
    let music_match = matches_binding(shortcut, &settings.download.music_hotkey_binding);

    if settings.download.clip_hotkey_enabled && clip_match {
        let _ = app.emit("clip-hotkey-pressed", serde_json::json!({}));
        return;
    }

    if settings.download.music_hotkey_enabled && music_match {
        handle_music_clipboard(app);
        return;
    }

    if settings.download.hotkey_enabled && download_match {
        handle_download_clipboard(app);
    }
}

fn matches_binding(pressed: &Shortcut, binding: &str) -> bool {
    binding
        .parse::<Shortcut>()
        .map(|s| s == *pressed)
        .unwrap_or(false)
}

fn handle_download_clipboard(app: &tauri::AppHandle) {
    clipboard_to_linkgrabber(app, "video");
}

fn handle_music_clipboard(app: &tauri::AppHandle) {
    clipboard_to_linkgrabber(app, "audio");
}

/// Read the clipboard and, if it holds a URL handled by a known platform, send
/// it to the LinkGrabber staging list (`mode` = "video" | "audio"); otherwise
/// emit a rejection so the UI can tell the user the link is not supported.
fn clipboard_to_linkgrabber(app: &tauri::AppHandle, mode: &str) {
    let raw = match app.clipboard().read_text() {
        Ok(t) => t.trim().to_string(),
        Err(_) => return,
    };
    if raw.is_empty() {
        return;
    }
    if is_recognized_media_url(app, &raw) {
        let _ = app.emit(
            "linkgrabber-add",
            serde_json::json!({ "url": raw, "mode": mode }),
        );
    } else {
        let _ = app.emit("linkgrabber-add-rejected", serde_json::json!({ "url": raw }));
    }
}

/// True for an `http(s)` URL that the platform registry recognizes.
fn is_recognized_media_url(app: &tauri::AppHandle, url: &str) -> bool {
    if !is_http_url(url) {
        return false;
    }
    let state = app.state::<crate::AppState>();
    state.registry.find_platform(url).is_some()
}

/// Pure URL-shape check: an `http(s)` URL that parses.
fn is_http_url(url: &str) -> bool {
    (url.starts_with("http://") || url.starts_with("https://")) && url::Url::parse(url).is_ok()
}

#[cfg(test)]
mod tests {
    use super::is_http_url;

    #[test]
    fn accepts_http_urls() {
        assert!(is_http_url("https://youtube.com/watch?v=abc"));
        assert!(is_http_url("http://example.com/a"));
    }

    #[test]
    fn rejects_non_http() {
        assert!(!is_http_url(""));
        assert!(!is_http_url("not a url"));
        assert!(!is_http_url("ftp://example.com"));
        assert!(!is_http_url("magnet:?xt=urn:btih:abc"));
    }
}
