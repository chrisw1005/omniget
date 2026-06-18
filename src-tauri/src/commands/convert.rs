use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

use tauri::{AppHandle, Emitter, State};
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use omniget_core::core::ffmpeg::{self, ConversionOptions, MediaProbeInfo};
use omniget_core::models::progress::ProgressUpdate;

use crate::AppState;

static CONVERSION_COUNTER: AtomicU64 = AtomicU64::new(1);

/// Probe a media file for format/stream metadata (resolution, codecs, bitrate, …).
#[tauri::command]
pub async fn convert_probe_file(path: String) -> Result<MediaProbeInfo, String> {
    ffmpeg::probe(std::path::Path::new(&path))
        .await
        .map_err(|e| e.to_string())
}

/// Extract a thumbnail frame as a base64 JPEG data URL. Returns `None` for audio-only inputs.
#[tauri::command]
pub async fn convert_extract_thumbnail(
    path: String,
    at_seconds: Option<f64>,
) -> Result<Option<String>, String> {
    ffmpeg::extract_thumbnail(std::path::Path::new(&path), at_seconds.unwrap_or(1.0))
        .await
        .map_err(|e| e.to_string())
}

/// Start a conversion. Returns a conversion id and streams progress over the
/// `convert-progress` event, finishing with `convert-complete`.
#[tauri::command]
pub async fn convert_start(
    app: AppHandle,
    state: State<'_, AppState>,
    options: ConversionOptions,
    duration_seconds: Option<f64>,
) -> Result<u64, String> {
    let conversion_id = CONVERSION_COUNTER.fetch_add(1, Ordering::SeqCst);
    let cancel_token = CancellationToken::new();
    state
        .active_conversions
        .lock()
        .await
        .insert(conversion_id, cancel_token.clone());

    let active = state.active_conversions.clone();
    let total_duration = duration_seconds.filter(|d| *d > 0.0);

    tokio::spawn(async move {
        let (tx, mut rx) = mpsc::channel::<ProgressUpdate>(32);

        let app_progress = app.clone();
        let cid = conversion_id;
        let started = Instant::now();
        let forwarder = tokio::spawn(async move {
            while let Some(update) = rx.recv().await {
                let percent = update.percent;
                let elapsed = started.elapsed().as_secs_f64();

                // ETA derived from real percent progress over wall-clock time.
                let eta_seconds = if percent > 0.5 {
                    Some(((elapsed * (100.0 - percent) / percent).max(0.0)) as u64)
                } else {
                    None
                };
                // Encoding speed multiplier (× real-time) when source duration is known.
                let speed = match total_duration {
                    Some(dur) if elapsed > 0.1 => Some((percent / 100.0 * dur) / elapsed),
                    _ => None,
                };

                let _ = app_progress.emit(
                    "convert-progress",
                    serde_json::json!({
                        "id": cid,
                        "percent": percent,
                        "eta_seconds": eta_seconds,
                        "speed": speed,
                    }),
                );
            }
        });

        let result = ffmpeg::convert(&options, cancel_token, tx).await;
        let _ = forwarder.await;
        active.lock().await.remove(&conversion_id);

        match result {
            Ok(conv) => {
                let err = conv.error.clone();
                let success = conv.success;
                let _ = app.emit(
                    "convert-complete",
                    serde_json::json!({
                        "id": conversion_id,
                        "success": success,
                        "result": conv,
                        "error": err,
                    }),
                );
            }
            Err(e) => {
                let _ = app.emit(
                    "convert-complete",
                    serde_json::json!({
                        "id": conversion_id,
                        "success": false,
                        "result": serde_json::Value::Null,
                        "error": e.to_string(),
                    }),
                );
            }
        }
    });

    Ok(conversion_id)
}

/// Cancel an in-flight conversion by id.
#[tauri::command]
pub async fn convert_cancel(state: State<'_, AppState>, conversion_id: u64) -> Result<(), String> {
    match state.active_conversions.lock().await.remove(&conversion_id) {
        Some(token) => {
            token.cancel();
            Ok(())
        }
        None => Err("No active conversion for this id".to_string()),
    }
}
