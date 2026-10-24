#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod sidecar;

use std::sync::Mutex;

use tauri::{Manager, RunEvent, WindowEvent};

use sidecar::{spawn_api_sidecar, wait_until_ready, SidecarHandle, API_PORT};

struct AppState {
    sidecar: Mutex<Option<SidecarHandle>>,
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .manage(AppState {
            sidecar: Mutex::new(None),
        })
        .setup(|app| {
            let handle = spawn_api_sidecar(app.handle())?;
            app.state::<AppState>()
                .sidecar
                .lock()
                .expect("sidecar lock")
                .replace(handle);

            wait_until_ready()?;

            let url = format!("http://127.0.0.1:{API_PORT}/")
                .parse()
                .expect("sidecar url");
            tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::External(url))
                .title("ACM-TRACKER")
                .inner_size(1280.0, 832.0)
                .min_inner_size(960.0, 640.0)
                .build()?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::CloseRequested { .. }) {
                kill_sidecar(window.app_handle());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
                kill_sidecar(app_handle);
            }
        });
}

fn kill_sidecar(app: &tauri::AppHandle) {
    if let Some(handle) = app
        .state::<AppState>()
        .sidecar
        .lock()
        .expect("sidecar lock")
        .take()
    {
        handle.kill();
    }
}
