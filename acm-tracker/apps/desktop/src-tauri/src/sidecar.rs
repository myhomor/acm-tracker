use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager};

pub const API_PORT: &str = "5188";

const READY_TIMEOUT: Duration = Duration::from_secs(60);

pub struct SidecarHandle {
    child: Child,
}

impl SidecarHandle {
    pub fn kill(mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

struct Payload {
    api_root: PathBuf,
    web_dist: PathBuf,
    prisma_schema: PathBuf,
    sidecar_entry: PathBuf,
    mcp_entry: PathBuf,
}

fn resolve_payload(app: &AppHandle) -> Result<Payload, String> {
    let base = payload_base(app)?;
    Ok(Payload {
        api_root: base.join("api"),
        web_dist: base.join("web-dist"),
        prisma_schema: base.join("api/prisma/sqlite/schema.prisma"),
        sidecar_entry: base.join("sidecar/bootstrap-and-serve.cjs"),
        mcp_entry: base.join("mcp/dist/index.js"),
    })
}

fn payload_base(app: &AppHandle) -> Result<PathBuf, String> {
    let bundled = app
        .path()
        .resource_dir()
        .map(|dir| dunce::simplified(&dir.join("payload")).to_path_buf())
        .map_err(|e| e.to_string())?;
    if bundled.join("sidecar/bootstrap-and-serve.cjs").exists() {
        return Ok(bundled);
    }
    let repo = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("payload");
    Ok(repo)
}

fn app_data_db_url(app: &AppHandle) -> Result<(String, PathBuf), String> {
    let dir = app
        .path()
        .app_data_dir()
        .map(|dir| dunce::simplified(&dir).to_path_buf())
        .map_err(|e| e.to_string())?;
    let db_file = dir.join("acm.db");
    Ok((format!("file:{}", db_file.display()), dir))
}

pub fn spawn_api_sidecar(app: &AppHandle) -> Result<SidecarHandle, String> {
    let payload = resolve_payload(app)?;
    let (database_url, app_data_dir) = app_data_db_url(app)?;
    let uploads_dir = app_data_dir.join("uploads");

    let child = Command::new("node")
        .arg(&payload.sidecar_entry)
        .env("DB_BACKEND", "sqlite")
        .env("DATABASE_URL", database_url)
        .env("WEB_DIST_DIR", &payload.web_dist)
        .env("UPLOADS_DIR", uploads_dir)
        .env("API_PORT", API_PORT)
        .env("ACM_API_ROOT", &payload.api_root)
        .env("ACM_PRISMA_SCHEMA", &payload.prisma_schema)
        .env("ACM_MCP_ENTRY", &payload.mcp_entry)
        .env("ACM_PARENT_PID", std::process::id().to_string())
        .spawn()
        .map_err(|e| format!("failed to spawn api sidecar: {e}"))?;

    Ok(SidecarHandle { child })
}

pub fn wait_until_ready() -> Result<(), String> {
    let addr = format!("127.0.0.1:{API_PORT}");
    let deadline = Instant::now() + READY_TIMEOUT;
    while Instant::now() < deadline {
        if api_responds(&addr) {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(400));
    }
    Err(format!("api sidecar did not become ready on {addr} within {READY_TIMEOUT:?}"))
}

fn api_responds(addr: &str) -> bool {
    let Ok(mut stream) = TcpStream::connect(addr) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let request = format!("GET /api/members HTTP/1.1\r\nHost: {addr}\r\nConnection: close\r\n\r\n");
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let mut buf = [0u8; 16];
    match stream.read(&mut buf) {
        Ok(n) if n > 0 => buf.starts_with(b"HTTP/1."),
        _ => false,
    }
}
