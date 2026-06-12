// 視窗工廠:contextIsolation:true, nodeIntegration:false, preload=.cjs
import { BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));

export function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "決策迭代器",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dir, "..", "preload", "index.cjs")
    }
  });

  win.loadFile(join(__dir, "..", "renderer", "index.html"));
  return win;
}
