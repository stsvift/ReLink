// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
use dirs::config_dir;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;
use tauri_plugin_updater::UpdaterExt;

#[tauri::command]
fn run_bat_file(app_handle: tauri::AppHandle, file_name: &str) -> Result<String, String> {
    let resource_path: PathBuf = if cfg!(debug_assertions) {
        env::current_dir()
            .map_err(|e| format!("Не удалось получить текущую директорию: {}", e))?
            .join("target")
            .join("bat_files")
            .join(file_name)
    } else {
        app_handle
            .path()
            .resource_dir()
            .map_err(|_| "Не удалось получить директорию ресурсов".to_string())?
            .join("target")
            .join("bat_files")
            .join(file_name)
    };

    // Проверяем существование файла
    if !resource_path.exists() {
        return Err(format!("Файл не найден: {:?}", resource_path));
    }

    // Выводим путь к файлу для отладки
    println!("Попытка запустить файл: {:?}", resource_path);

    let output = Command::new(resource_path)
        .output()
        .map_err(|e| format!("Не удалось выполнить команду: {}", e))?;

    if output.status.success() {
        Ok(format!("Файл {} успешно запущен", file_name))
    } else {
        Err(format!(
            "Не удалось запустить {}. Ошибка: {}",
            file_name,
            String::from_utf8_lossy(&output.stderr)
        ))
    }
}

#[tauri::command]
fn toggle_autostart(file_name: &str, is_enabled: bool) -> Result<(), String> {
    let autostart_dir = config_dir()
        .ok_or_else(|| "Не удалось получить директорию конфигурации".to_string())?
        .join("Microsoft")
        .join("Windows")
        .join("Start Menu")
        .join("Programs")
        .join("Startup");

    let bat_path = env::current_dir()
        .map_err(|e| format!("Не удалось получить текущую директорию: {}", e))?
        .join("target")
        .join("bat_files")
        .join(file_name);

    let autostart_path = autostart_dir.join(file_name);

    if is_enabled {
        fs::copy(&bat_path, &autostart_path)
            .map_err(|e| format!("Не удалось скопировать файл в автозапуск: {}", e))?;
    } else {
        fs::remove_file(&autostart_path)
            .map_err(|e| format!("Не удалось удалить файл из автозапуска: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
async fn check_update(app_handle: tauri::AppHandle) -> Result<String, String> {
    let updater = app_handle
        .updater()
        .map_err(|e| format!("Ошибка при получении обновления: {}", e))?;
    match updater.check().await {
        Ok(Some(update)) => Ok(format!(
            "Доступно обновление: версия {}. Нажмите, чтобы установить.",
            update.version
        )),
        Ok(None) => Ok("Обновлений не найдено. У вас установлена последняя версия.".to_string()),
        Err(e) => Err(format!("Ошибка при проверке обновлений: {}", e)),
    }
}

#[tauri::command]
async fn install_update(app_handle: tauri::AppHandle) -> Result<(), String> {
    let updater = app_handle
        .updater()
        .map_err(|e| format!("Ошибка при получении обновления: {}", e))?;
    match updater.check().await {
        Ok(Some(update)) => {
            update
                .download_and_install(
                    |progress, total| {
                        println!("Загружено {}/{} байт", progress, total.unwrap_or(0));
                    },
                    || {
                        println!("Загрузка завершена");
                    },
                )
                .await
                .map_err(|e| format!("Ошибка при установке обновления: {}", e))?;
            Ok(())
        }
        Ok(None) => Err("Нет доступных обновлений".to_string()),
        Err(e) => Err(format!("Ошибка при проверке обновлений: {}", e)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            run_bat_file,
            toggle_autostart,
            get_app_version,
            check_update,
            install_update
        ])
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
