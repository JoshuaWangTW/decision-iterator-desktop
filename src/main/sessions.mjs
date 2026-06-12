// session CRUD — 儲存在 userData/sessions/<id>/
import { app } from "electron";
import {
  mkdirSync, writeFileSync, readFileSync, readdirSync,
  existsSync, renameSync
} from "node:fs";
import { join } from "node:path";

function sessionsRoot() {
  return join(app.getPath("userData"), "sessions");
}

function sessionDir(id) {
  return join(sessionsRoot(), id);
}

function statePath(id) {
  return join(sessionDir(id), "session-state.json");
}

/** Windows file:// 路徑:三斜線 + 正斜線 */
export function dashboardUrl(id) {
  const p = join(sessionDir(id), "dashboard.html").replaceAll("\\", "/");
  return "file:///" + p;
}

/** 標題 → kebab-case slug(保留中文) */
function slugify(s) {
  return String(s).trim().toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "session";
}

/** 原子寫檔(tmp + rename,避免寫到一半被讀) */
export function writeStateAtomic(id, state) {
  const dir = sessionDir(id);
  mkdirSync(dir, { recursive: true });
  const target = statePath(id);
  const tmp = target + ".tmp";
  writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n", "utf8");
  renameSync(tmp, target);
}

/** 建立新 session,回傳 {id, dir, dashboardUrl} */
export function createSession({ title, lens = "business" }) {
  mkdirSync(sessionsRoot(), { recursive: true });
  const now = new Date().toISOString();
  const date = now.slice(0, 10);
  const id = `${date}-${slugify(title)}`;

  const dir = sessionDir(id);
  mkdirSync(dir, { recursive: true });

  const state = {
    schemaVersion: "1.0",
    session: { id, title, createdAt: now, updatedAt: now },
    lens,
    phase: "frame",
    frame: { rawAsk: title, decision: "", owner: "", stakes: "", successCriteria: "" },
    nodes: [],
    insights: [],
    decision: { options: [], chosen: "", nextSteps: [] },
    timeline: [{ ts: now, type: "phase-change", detail: "建立 session,進入 FRAME 階段" }],
    redFlags: []
  };

  writeStateAtomic(id, state);

  return { id, dir, dashboardUrl: dashboardUrl(id) };
}

/** 讀取 session 狀態,回傳 {state, dashboardUrl} 或 null */
export function getSession(id) {
  const p = statePath(id);
  if (!existsSync(p)) return null;
  try {
    const state = JSON.parse(readFileSync(p, "utf8"));
    return { state, dashboardUrl: dashboardUrl(id) };
  } catch {
    return null;
  }
}

/** 列出所有 sessions,按 updatedAt 降序 */
export function listSessions() {
  const root = sessionsRoot();
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const p = join(root, d.name, "session-state.json");
      if (!existsSync(p)) return null;
      try {
        const s = JSON.parse(readFileSync(p, "utf8"));
        return {
          id: d.name,
          title: (s.session && s.session.title) || d.name,
          updatedAt: (s.session && s.session.updatedAt) || ""
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
}
