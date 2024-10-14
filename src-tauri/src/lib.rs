// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
use std::process::Command;
use tauri::Manager;
use std::env;
use std::fs;
use dirs::config_dir;
use tauri_plugin_updater::UpdaterExt;

#[tauri::command]
fn run_bat_file(app_handle: tauri::AppHandle, file_name: &str) -> Result<String, String> {
    let resource_path = if cfg!(debug_assertions) {
        // В режиме разработки используем путь относительно текущей директории
        env::current_dir()
            .map_err(|e| e.to_string())?
            .join("target")
            .join("bat_files")
            .join(file_name)
    } else {
        // В режиме релиза используем resource_dir
        app_handle.path().resource_dir()
            .map(|dir| dir.join("bat_files").join(file_name))
            .map_err(|_| "Failed to get resource directory".to_string())?
    };

    // Проверяем существование файла
    if !resource_path.exists() {
        return Err(format!("File not found: {:?}", resource_path));
    }

    // Выводим путь к файлу для отладки
    println!("Attempting to run file: {:?}", resource_path);

    let output = Command::new("cmd")
        .args(&["/C", resource_path.to_str().unwrap()])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
fn toggle_autostart(file_name: &str, is_enabled: bool) -> Result<(), String> {
    let autostart_dir = config_dir()
        .ok_or_else(|| "Failed to get config directory".to_string())?
        .join("Microsoft")
        .join("Windows")
        .join("Start Menu")
        .join("Programs")
        .join("Startup");

    let bat_path = env::current_dir()
        .map_err(|e| e.to_string())?
        .join("target")
        .join("bat_files")
        .join(file_name);

    let autostart_path = autostart_dir.join(file_name);

    if is_enabled {
        fs::copy(&bat_path, &autostart_path)
            .map_err(|e| format!("Failed to copy file to autostart: {}", e))?;
    } else {
        fs::remove_file(&autostart_path)
            .map_err(|e| format!("Failed to remove file from autostart: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
async fn check_update(app_handle: tauri::AppHandle) -> Result<String, String> {
    let updater = app_handle.updater().map_err(|e| e.to_string())?;
    match updater.check().await {
        Ok(Some(update)) => {
            Ok(format!("Доступно обновление: версия {}. Нажмите, чтобы установить.", update.version))
        },
        Ok(None) => Ok("Обновлений не найдено. У вас установлена последняя версия.".to_string()),
        Err(e) => Err(format!("Ошибка при проверке обновлений: {}", e)),
    }
}

#[tauri::command]
async fn install_update(app_handle: tauri::AppHandle) -> Result<(), String> {
    let updater = app_handle.updater().map_err(|e| e.to_string())?;
    match updater.check().await {
        Ok(Some(update)) => {
            update.download_and_install(
                |progress, total| {
                    println!("Downloaded {}/{} bytes", progress, total.unwrap_or(0));
                },
                || {
                    println!("Download finished");
                }
            ).await.map_err(|e| e.to_string())?;
            Ok(())
        },
        Ok(None) => Err("No update available".to_string()),
        Err(e) => Err(format!("Error checking for update: {}", e)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![run_bat_file, toggle_autostart, get_app_version, check_update, install_update])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            
            // Добавляем автоматическую проверку обновлений при запуске
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match handle.updater() {
                    Ok(updater) => {
                        match updater.check().await {
                            Ok(Some(update)) => {
                                println!("Update available: {}", update.version);
                                // Здесь вы можете добавить логику для уведомления пользователя о доступном обновлении
                            }
                            Ok(None) => println!("No update available"),
                            Err(e) => println!("Error checking for updates: {}", e),
                        }
                    }
                    Err(e) => println!("Error getting updater: {}", e),
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
