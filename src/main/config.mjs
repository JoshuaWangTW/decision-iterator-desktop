// 設定:金鑰偵測、路徑常數、模型常數
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
export const ASSETS_DIR = join(__dir, "..", "..", "assets");
export const TEMPLATE_PATH = join(ASSETS_DIR, "dashboard-template.html");
export const MODEL = "claude-sonnet-4-6";

/**
 * 取得 API 金鑰。優先 ANTHROPIC_API_KEY 環境變數。
 * Claude Code CLI 的登入憑證不透過此路徑(桌面版需明確設 env 或 .env)。
 */
export function getApiKey() {
  return process.env.ANTHROPIC_API_KEY || null;
}

export const NO_KEY_MESSAGE =
  "尚未設定 API 金鑰。\n\n" +
  "請設定環境變數 ANTHROPIC_API_KEY 後重新啟動:\n" +
  "  Windows PowerShell: $env:ANTHROPIC_API_KEY = 'sk-ant-...'\n" +
  "  或在系統環境變數中永久設定\n\n" +
  "取得金鑰:https://console.anthropic.com/settings/keys";
