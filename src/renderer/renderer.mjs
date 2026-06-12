// Renderer 進程:串流 UI + session 管理
// window.di 由 preload/index.cjs 注入

const di = window.di;

// ===== 狀態 =====
let currentSessionId = null;
let isSending = false;
let streamingBubble = null; // 串流中的 assistant 泡泡元素

// ===== DOM refs =====
const sessionSelect = document.getElementById("session-select");
const btnNewSession = document.getElementById("btn-new-session");
const chatMessages = document.getElementById("chat-messages");
const statusBar = document.getElementById("status-bar");
const chatInput = document.getElementById("chat-input");
const btnSend = document.getElementById("btn-send");
const board = document.getElementById("board");
const boardEmpty = document.getElementById("board-empty");
const btnOpenFolder = document.getElementById("btn-open-folder");
const newSessionMask = document.getElementById("new-session-mask");
const inputTitle = document.getElementById("input-title");
const inputLens = document.getElementById("input-lens");
const btnModalCancel = document.getElementById("btn-modal-cancel");
const btnModalCreate = document.getElementById("btn-modal-create");

// ===== 初始化 =====
async function init() {
  await loadSessionList();
  setupIpcListeners();
  setupInputHandlers();
}

// ===== Session 管理 =====
async function loadSessionList() {
  const sessions = await di.sessions.list();
  sessionSelect.innerHTML = sessions.length
    ? sessions.map(s =>
        `<option value="${esc(s.id)}">${esc(s.title || s.id)}</option>`
      ).join("")
    : `<option value="">（尚無 session）</option>`;

  if (sessions.length > 0) {
    await selectSession(sessions[0].id);
  }
}

async function selectSession(id) {
  if (!id) return;
  currentSessionId = id;
  sessionSelect.value = id;
  updateSendButton();

  const result = await di.sessions.get(id);
  if (result) {
    reloadBoard(result.dashboardUrl);
    setStatus("Session 載入完成");
  }
}

function reloadBoard(url) {
  boardEmpty.hidden = true;
  board.hidden = false;
  board.src = url + "?t=" + Date.now();
}

// ===== 新 Session Modal =====
btnNewSession.addEventListener("click", () => {
  inputTitle.value = "";
  inputLens.value = "business";
  newSessionMask.hidden = false;
  inputTitle.focus();
});

btnModalCancel.addEventListener("click", () => {
  newSessionMask.hidden = true;
});

newSessionMask.addEventListener("click", (e) => {
  if (e.target === newSessionMask) newSessionMask.hidden = true;
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") newSessionMask.hidden = true;
});

btnModalCreate.addEventListener("click", async () => {
  const title = inputTitle.value.trim();
  if (!title) { inputTitle.focus(); return; }
  const lens = inputLens.value;
  newSessionMask.hidden = true;

  setStatus("建立 session 中…");
  const result = await di.sessions.create({ title, lens });
  currentSessionId = result.id;

  // 更新下拉選單
  const opt = document.createElement("option");
  opt.value = result.id;
  opt.textContent = title;
  sessionSelect.prepend(opt);
  sessionSelect.value = result.id;

  reloadBoard(result.dashboardUrl);
  chatMessages.innerHTML = "";
  updateSendButton();
  setStatus("新 session 已建立,可以開始對話了");
  chatInput.focus();
});

sessionSelect.addEventListener("change", () => {
  selectSession(sessionSelect.value);
  chatMessages.innerHTML = "";
});

// ===== 送訊息 =====
function updateSendButton() {
  btnSend.disabled = !currentSessionId || isSending;
  chatInput.disabled = !currentSessionId || isSending;
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || !currentSessionId || isSending) return;

  isSending = true;
  updateSendButton();

  // 顯示使用者泡泡
  appendBubble("user", text);
  chatInput.value = "";

  // 準備串流 assistant 泡泡
  streamingBubble = appendBubble("assistant", "");
  streamingBubble.classList.add("streaming");
  setStatus("AI 思考中…");

  await di.turn.send(currentSessionId, text);
  // 實際完成由 onDone/onError 回呼處理
}

// ===== IPC 回呼 =====
function setupIpcListeners() {
  di.turn.onDelta(({ text }) => {
    if (streamingBubble) {
      streamingBubble.textContent += text;
      scrollToBottom();
    }
  });

  di.turn.onStateUpdated(({ dashboardUrl }) => {
    reloadBoard(dashboardUrl);
  });

  di.turn.onDone(({ stopReason }) => {
    if (streamingBubble) {
      streamingBubble.classList.remove("streaming");
      // 若包含「現在只要做一件事」標記收尾引導樣式
      if (streamingBubble.textContent.includes("現在只要做")) {
        streamingBubble.classList.add("closing");
      }
      streamingBubble = null;
    }
    isSending = false;
    updateSendButton();
    setStatus("完成 · " + new Date().toLocaleTimeString());
    chatInput.focus();
  });

  di.turn.onError(({ message }) => {
    if (streamingBubble) {
      streamingBubble.remove();
      streamingBubble = null;
    }
    appendBubble("error", message);
    isSending = false;
    updateSendButton();
    setStatus("發生錯誤");
  });
}

// ===== 輸入事件 =====
function setupInputHandlers() {
  btnSend.addEventListener("click", sendMessage);

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // 自動調整高度
  chatInput.addEventListener("input", () => {
    chatInput.style.height = "auto";
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
  });
}

// ===== 開啟資料夾 =====
btnOpenFolder.addEventListener("click", () => {
  if (currentSessionId) di.sessions.openFolder(currentSessionId);
});

// ===== 工具函式 =====
function appendBubble(role, text) {
  const div = document.createElement("div");
  div.className = "bubble " + role;
  div.textContent = text;
  chatMessages.appendChild(div);
  scrollToBottom();
  return div;
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setStatus(msg) {
  statusBar.textContent = msg;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}

// 啟動
init();
