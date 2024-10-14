fn main() {
    tauri_build::build();

    println!("cargo:rerun-if-changed=target/bat_files");
}
