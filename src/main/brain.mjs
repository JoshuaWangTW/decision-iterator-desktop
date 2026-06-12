// Agent SDK 包裝:runTurn()
import { query } from "@anthropic-ai/claude-agent-sdk";
import { SYSTEM_PROMPT } from "./system-prompt.mjs";
import { createStateServer, stateEmitter } from "./state-tool.mjs";
import { getApiKey, NO_KEY_MESSAGE, MODEL } from "./config.mjs";
import { app } from "electron";
import { join } from "node:path";

// 記憶體 Map:sessionId → sdkSessionId(多輪 resume 用)
const sdkSessionIds = new Map();

/**
 * 執行一輪 Agent 對話
 * @param {object} opts
 * @param {string} opts.sessionId        di session id
 * @param {string} opts.userText         使用者輸入文字
 * @param {function} opts.onDelta        (text: string) => void  串流 chunk 回呼
 * @param {function} opts.onStateUpdated ({id, dashboardUrl}) => void  看板更新回呼
 * @param {function} opts.onDone         ({stopReason: string}) => void
 * @param {function} opts.onError        ({message: string}) => void
 */
export async function runTurn({ sessionId, userText, onDelta, onStateUpdated, onDone, onError }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    onError({ message: NO_KEY_MESSAGE });
    return;
  }

  const sessionDir = join(app.getPath("userData"), "sessions", sessionId);

  // 建立 MCP server 並訂閱 state-updated
  const stateServer = createStateServer(sessionId);

  const stateListener = (payload) => onStateUpdated(payload);
  stateEmitter.on("state-updated", stateListener);

  try {
    const resumeId = sdkSessionIds.get(sessionId);

    const q = query({
      prompt: userText,
      options: {
        systemPrompt: SYSTEM_PROMPT,
        mcpServers: { "di-state": stateServer },
        allowedTools: ["mcp__di-state__update_session_state"],
        disallowedTools: ["Bash", "Read", "Write", "Edit"],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        settingSources: [],
        includePartialMessages: true,
        maxTurns: 6,
        model: MODEL,
        cwd: sessionDir,
        env: { ...process.env, ANTHROPIC_API_KEY: apiKey },
        ...(resumeId ? { resume: resumeId } : {})
      }
    });

    let stopReason = "end_turn";

    for await (const msg of q) {
      if (msg.type === "stream_event") {
        // 串流文字 delta — event 是 BetaRawMessageStreamEvent
        const ev = msg.event;
        if (ev && ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta" && ev.delta.text) {
          onDelta({ id: sessionId, text: ev.delta.text });
        }
      } else if (msg.type === "assistant") {
        // 首輪抓 session_id 持久化(多輪 resume)
        if (msg.session_id && !sdkSessionIds.has(sessionId)) {
          sdkSessionIds.set(sessionId, msg.session_id);
        }
      } else if (msg.type === "result") {
        if (msg.subtype === "success") {
          stopReason = "end_turn";
        } else {
          stopReason = msg.subtype || "error";
        }
      }
    }

    onDone({ id: sessionId, stopReason });
  } catch (err) {
    onError({ message: String(err?.message || err) });
  } finally {
    stateEmitter.off("state-updated", stateListener);
  }
}
