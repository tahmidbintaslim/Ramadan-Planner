// Thin desktop shell: the main window (tauri.conf.json) loads the deployed site; no commands or plugins.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
