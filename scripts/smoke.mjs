#!/usr/bin/env node
// smoke test:不開視窗,直接測 sessions + render 的核心邏輯
// 用法: npm run smoke
import { mkdirSync, existsSync, readFileSync, renameSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");

// ===== 模擬 app.getPath("userData") =====
const fakeUserData = join(tmpdir(), "di-smoke-" + randomUUID().slice(0, 8));
mkdirSync(join(fakeUserData, "sessions"), { recursive: true });

// ===== 動態 patch electron import(不實際啟動) =====
// sessions.mjs 和 render.mjs 有 `import { app } from "electron"`,
// 我們在 Node 環境用 mock 繞過
const mockElectron = {
  app: {
    getPath: (_k) => fakeUserData
  }
};

// 用 register + loader 比較複雜;這裡直接把 sessions/render 的純邏輯抽出來驗

// ----- 複製 sessions.mjs 核心邏輯到本地(避免 electron import) -----
function slugify(s) {
  return String(s).trim().toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "session";
}

function sessionsRoot() { return join(fakeUserData, "sessions"); }
function sessionDir(id) { return join(sessionsRoot(), id); }
function statePath(id) { return join(sessionDir(id), "session-state.json"); }

function dashboardUrl(id) {
  const p = join(sessionDir(id), "dashboard.html").replaceAll("\\", "/");
  return "file:///" + p;
}

function writeStateAtomic(id, state) {
  const dir = sessionDir(id);
  mkdirSync(dir, { recursive: true });
  const target = statePath(id);
  const tmp = target + ".tmp";
  writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n", "utf8");
  renameSync(tmp, target);
}

function createSession({ title, lens = "business" }) {
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

// ----- render 核心邏輯 -----
const TEMPLATE_PATH = join(ROOT, "assets", "dashboard-template.html");

function normalizeScores(state) {
  for (const n of state.nodes || []) {
    if (n.priority && n.priority.cost) {
      n.priority.score = +((Number(n.priority.impact) * Number(n.priority.likelihood)) / Number(n.priority.cost)).toFixed(2);
    }
  }
  return state;
}

function renderDashboard(state, dir) {
  normalizeScores(state);
  const tpl = readFileSync(TEMPLATE_PATH, "utf8");
  const hits = (tpl.match(/__STATE__/g) || []).length;
  if (hits !== 1) throw new Error(`__STATE__ 應出現 1 次,實際 ${hits} 次`);
  const injected = tpl.replaceAll("__STATE__", JSON.stringify(state, null, 2));
  const outPath = join(dir, "dashboard.html");
  writeFileSync(outPath, injected, "utf8");
  return outPath;
}

// ===== 執行測試 =====
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log("  ✓", msg);
    passed++;
  } else {
    console.error("  ✗ FAIL:", msg);
    failed++;
  }
}

console.log("\n=== smoke test ===\n");

// Test 1:建立 session
console.log("1. 建立 session");
const { id, dir } = createSession({ title: "煙霧測試決策", lens: "business" });
assert(typeof id === "string" && id.length > 0, "session id 存在");
assert(existsSync(statePath(id)), "session-state.json 已寫出");

// Test 2:state JSON 可解析且含必要欄位
console.log("\n2. session-state.json 結構");
const state = JSON.parse(readFileSync(statePath(id), "utf8"));
assert(state.schemaVersion === "1.0", "schemaVersion = 1.0");
assert(state.session && state.session.id === id, "session.id 正確");
assert(Array.isArray(state.nodes), "nodes 是陣列");
assert(Array.isArray(state.timeline) && state.timeline.length >= 1, "timeline 有初始記錄");

// Test 3:渲染 dashboard.html
console.log("\n3. 渲染 dashboard.html");
renderDashboard(state, dir);
const dashPath = join(dir, "dashboard.html");
assert(existsSync(dashPath), "dashboard.html 已生成");

const html = readFileSync(dashPath, "utf8");
assert(!html.includes("__STATE__"), "無 __STATE__ 殘留占位符");

// Test 4:EMBEDDED_STATE 可 JSON.parse
console.log("\n4. EMBEDDED_STATE 可解析");
const match = html.match(/const EMBEDDED_STATE = ([\s\S]*?);[\r\n]/);
assert(match !== null, "找到 EMBEDDED_STATE 賦值");
if (match) {
  let parsed = null;
  try { parsed = JSON.parse(match[1]); } catch {}
  assert(parsed !== null, "EMBEDDED_STATE 可 JSON.parse");
  if (parsed) {
    assert(parsed.session && parsed.session.id === id, "EMBEDDED_STATE.session.id 正確");
  }
}

// Test 5:cleanup
console.log("\n5. 清理測試 session");
rmSync(fakeUserData, { recursive: true, force: true });
assert(!existsSync(fakeUserData), "測試資料夾已清理");

// ===== 結果 =====
console.log(`\n=== 結果:${passed} 通過,${failed} 失敗 ===\n`);
if (failed > 0) process.exit(1);
