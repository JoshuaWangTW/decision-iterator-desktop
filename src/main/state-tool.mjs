// update_session_state 工具:handler 寫檔+渲染+emit
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod/v4";
import { EventEmitter } from "node:events";
import { app } from "electron";
import { join } from "node:path";
import { writeStateAtomic, dashboardUrl } from "./sessions.mjs";
import { renderDashboard } from "./render.mjs";

// 全域 emitter:state-tool → brain → main 發 IPC
export const stateEmitter = new EventEmitter();

/**
 * 淺層補正:確保頂層必要欄位存在(不阻擋額外欄位)
 * lintState 精神:缺頂層補空,不抛錯
 */
function lintAndFill(state) {
  if (!state.session) state.session = {};
  if (!state.session.updatedAt) state.session.updatedAt = new Date().toISOString();
  if (!state.schemaVersion) state.schemaVersion = "1.0";
  if (!state.lens) state.lens = "business";
  if (!state.phase) state.phase = "frame";
  if (!state.frame) state.frame = { rawAsk: "", decision: "", owner: "", stakes: "", successCriteria: "" };
  if (!Array.isArray(state.nodes)) state.nodes = [];
  if (!Array.isArray(state.insights)) state.insights = [];
  if (!state.decision) state.decision = { options: [], chosen: "", nextSteps: [] };
  if (!Array.isArray(state.timeline)) state.timeline = [];
  if (!Array.isArray(state.redFlags)) state.redFlags = [];
}

/**
 * 建立 SDK MCP server,綁定 sessionId
 * @param {string} sessionId
 */
export function createStateServer(sessionId) {
  const stateTool = tool(
    "update_session_state",
    "把這一輪推進後的**完整** session 狀態寫回。必須是符合 schema 1.0 的整份 state,不是差異。每次都要:更新 session.updatedAt 為現在 ISO8601、對有意義的變更 append 一筆 timeline。score 可留 0,渲染端會重算。",
    // .passthrough() 容錯:模型多塞欄位不被 reject
    { state: z.object({}).passthrough() },
    async ({ state }) => {
      // 補正 updatedAt,確保永遠有值
      if (!state.session) state.session = {};
      state.session.updatedAt = new Date().toISOString();
      lintAndFill(state);

      const sessionDir = join(app.getPath("userData"), "sessions", sessionId);

      // 原子寫
      writeStateAtomic(sessionId, state);

      // 渲染看板
      try {
        renderDashboard(state, sessionDir);
      } catch (e) {
        console.warn("[state-tool] 渲染失敗:", e.message);
      }

      // 通知 main 發 state-updated IPC
      stateEmitter.emit("state-updated", {
        id: sessionId,
        dashboardUrl: dashboardUrl(sessionId)
      });

      return { content: [{ type: "text", text: "狀態已更新並重繪看板。" }] };
    }
  );

  return createSdkMcpServer({
    name: "di-state",
    version: "1.0.0",
    tools: [stateTool]
  });
}
