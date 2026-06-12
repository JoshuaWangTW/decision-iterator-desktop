// preload:contextBridge 白名單,絕不曝 ipcRenderer
// 必須是 .cjs(Electron preload 不支援 ESM)
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("di", {
  // sessions
  sessions: {
    list: () => ipcRenderer.invoke("di:sessions:list"),
    create: (opts) => ipcRenderer.invoke("di:sessions:create", opts),
    get: (id) => ipcRenderer.invoke("di:sessions:get", { id }),
    openFolder: (id) => ipcRenderer.invoke("di:sessions:openFolder", { id })
  },

  // turn(非同步串流:以 on* 回呼取代直接回傳)
  turn: {
    send: (id, text) => ipcRenderer.invoke("di:turn:send", { id, text }),
    onDelta: (cb) => {
      ipcRenderer.on("di:turn:delta", (_e, data) => cb(data));
    },
    onStateUpdated: (cb) => {
      ipcRenderer.on("di:turn:state-updated", (_e, data) => cb(data));
    },
    onDone: (cb) => {
      ipcRenderer.on("di:turn:done", (_e, data) => cb(data));
    },
    onError: (cb) => {
      ipcRenderer.on("di:turn:error", (_e, data) => cb(data));
    }
  }
});
