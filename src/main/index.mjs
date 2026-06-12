// 主進程入口:BrowserWindow、ipcMain handlers、app.whenReady
import { app, ipcMain, shell } from "electron";
import { join } from "node:path";
import { createMainWindow } from "./window.mjs";
import {
  createSession, listSessions, getSession, dashboardUrl
} from "./sessions.mjs";
import { renderDashboard } from "./render.mjs";
import { runTurn } from "./brain.mjs";

let mainWindow = null;

app.whenReady().then(() => {
  mainWindow = createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ===== IPC handlers =====

/** di:sessions:list → {id, title, updatedAt}[] */
ipcMain.handle("di:sessions:list", () => listSessions());

/** di:sessions:create → {id, dir, dashboardUrl} */
ipcMain.handle("di:sessions:create", (_e, { title, lens }) => {
  const result = createSession({ title, lens });
  // 初始渲染:生成空狀態看板
  const session = getSession(result.id);
  if (session) {
    try {
      renderDashboard(session.state, result.dir);
    } catch (e) {
      console.warn("[main] 初始渲染失敗:", e.message);
    }
  }
  return result;
});

/** di:sessions:get → {state, dashboardUrl} */
ipcMain.handle("di:sessions:get", (_e, { id }) => getSession(id));

/** di:sessions:openFolder → shell.openPath */
ipcMain.handle("di:sessions:openFolder", (_e, { id }) => {
  const dir = join(app.getPath("userData"), "sessions", id);
  shell.openPath(dir);
});

/** di:turn:send → 啟動 Agent 輪次,以事件推流 */
ipcMain.handle("di:turn:send", async (_e, { id, text }) => {
  await runTurn({
    sessionId: id,
    userText: text,
    onDelta: (payload) => {
      mainWindow?.webContents.send("di:turn:delta", payload);
    },
    onStateUpdated: (payload) => {
      mainWindow?.webContents.send("di:turn:state-updated", payload);
    },
    onDone: (payload) => {
      mainWindow?.webContents.send("di:turn:done", payload);
    },
    onError: (payload) => {
      mainWindow?.webContents.send("di:turn:error", payload);
    }
  });
  return { ok: true };
});
