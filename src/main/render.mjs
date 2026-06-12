// vendored 渲染純函式
// 來源: C:\Users\User\.claude\skills\decision-iterator\assets\dashboard-template.html
// 移植自: C:\Users\User\.claude\skills\decision-iterator\bin\render.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TEMPLATE_PATH } from "./config.mjs";
import { writeStateAtomic } from "./sessions.mjs";

/** 重算所有節點優先分數(就地修改,回傳 state 本身) */
function normalizeScores(state) {
  for (const n of state.nodes || []) {
    if (n.priority && n.priority.cost) {
      n.priority.score = +((Number(n.priority.impact) * Number(n.priority.likelihood)) / Number(n.priority.cost)).toFixed(2);
    }
  }
  return state;
}

/**
 * 渲染看板:重算分數 → 注入模板 → 寫出 dashboard.html
 * @param {object} state  完整 session-state 物件
 * @param {string} dir    session 資料夾絕對路徑
 */
export function renderDashboard(state, dir) {
  normalizeScores(state);

  const tpl = readFileSync(TEMPLATE_PATH, "utf8");
  const hits = (tpl.match(/__STATE__/g) || []).length;
  if (hits !== 1) {
    throw new Error(`模板占位符 __STATE__ 應恰好出現 1 次,實際 ${hits} 次`);
  }

  // 跳脫 < > 與行分隔符後再內嵌(與 web 軌 parity):JSON.stringify 不跳脫
  // 這些字元,直接塞進 <script> 會被 HTML 解析提早關閉 script。桌面看板在
  // 沙箱 file:// iframe、本地自有內容,風險為 LOW,仍做一致防護。
  const json = JSON.stringify(state, null, 2)
    .replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  const injected = tpl.replaceAll("__STATE__", () => json);
  const outPath = join(dir, "dashboard.html");
  writeFileSync(outPath, injected, "utf8");
  return outPath;
}
