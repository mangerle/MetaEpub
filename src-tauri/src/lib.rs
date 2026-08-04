// 读取本地 EPUB 文件字节，通过原生文件对话框选择的路径
#[tauri::command]
fn read_epub_file(path: String) -> Result<tauri::ipc::Response, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

// 将导出后的 EPUB 字节写入到用户指定的路径
#[tauri::command]
fn save_epub_file(path: String, data: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, data).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![read_epub_file, save_epub_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}