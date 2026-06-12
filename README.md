# 決策迭代器 — 桌面版

Electron 應用程式。左側聊天窗口與決策大腦對話，右側看板即時顯示思路全貌。把商業或職涯決策當成產品持續迭代：框定 → 拆解 → 排序 → 驗證 → 收斂 → 決策。

---

## 30 秒啟動

**前提：Node.js 18+ 已安裝、ANTHROPIC_API_KEY 已設定（見下節）**

```powershell
# 1. 進到專案目錄（如果還沒在裡面）
cd D:\aiproject\decision-iterator-desktop

# 2. 安裝依賴（已裝過可略）
npm install

# 3. 啟動
npm start
```

---

## 設定 API 金鑰

取得金鑰：[https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)

**本次工作階段（暫時，關閉 PowerShell 即失效）**

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-..."
npm start
```

**永久設定（推薦）**

1. 開啟「系統環境變數」：Win + R → `sysdm.cpl` → 「進階」→「環境變數」
2. 在「使用者變數」新增：
   - 變數名稱：`ANTHROPIC_API_KEY`
   - 值：`sk-ant-...`
3. 重新開啟 PowerShell，執行 `npm start`

> 若未設定金鑰，聊天窗口會顯示設定指引；補設後重啟即可，不需修改程式碼。

---

## 用法

1. **建立 Session**：點選左側「新增決策」，輸入標題與鏡頭（商業/職涯/混合），按「開始」
2. **開始對話**：在底部輸入框描述你的決策問題，送出後大腦開始串流回應
3. **看板自動更新**：每次大腦呼叫 `update_session_state`，右側看板 iframe 自動重載，顯示最新節點與分數
4. **切換 Session**：左側列表點選其他 session 即切換；歷史對話與狀態自動還原

### 看板說明

- 節點依 `影響 × 可能性 ÷ 成本` 排序，高分節點顏色較深
- 右上角「時間軸」顯示每次狀態變更記錄
- 看板唯讀，所有操作在聊天裡進行

---

## Session 存放位置

Session 資料存在 Electron 的 `userData` 目錄：

```
C:\Users\<你的使用者名稱>\AppData\Roaming\decision-iterator-desktop\sessions\
```

每個 Session 是一個子資料夾，包含：
- `session-state.json`：完整狀態（JSON）
- `dashboard.html`：最新看板快照

在聊天界面點選右上角「開啟資料夾」按鈕，可直接用 Explorer 開啟對應 session 目錄。

---

## 故障排除

| 問題 | 處理方式 |
|------|----------|
| 聊天顯示「尚未設定 API 金鑰」 | 設定 `ANTHROPIC_API_KEY` 環境變數後重啟 |
| 視窗未出現（無頭伺服器） | 桌面版需要顯示器；WSL 無 GUI 環境無法執行 |
| npm start 報錯找不到 electron | 執行 `npm install` 後重試 |
| 看板顯示空白 | 正常；送出第一則訊息後看板才會生成 |

---

## 技術規格

- Runtime：Electron 31+（`electron .`，開發模式，未打包）
- 大腦：Claude Agent SDK（`@anthropic-ai/claude-agent-sdk`）
- 模型：`claude-sonnet-4-6`（`src/main/config.mjs` 可改）
- 狀態：`userData/sessions/<id>/session-state.json`（全量覆寫，原子寫入）
