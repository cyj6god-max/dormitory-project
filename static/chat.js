/**
 * chat.js — 기숙사 챗봇 클라이언트 스크립트 (카테고리 없는 채팅 전용)
 */

let isLoading = false;

// ── 빠른 질문 칩 ──────────────────────────────
function sendQuick(text) {
  const input = document.getElementById("user-input");
  if (!input) return;
  input.value = text;
  sendMessage();
}

// ── Enter 키 처리 ─────────────────────────────
function handleKeydown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

// ── textarea 자동 높이 ──────────────────────────
function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}

// ── 메시지 전송 ───────────────────────────────
async function sendMessage() {
  if (isLoading) return;

  const input   = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  // 입력 초기화
  input.value = "";
  input.style.height = "auto";

  // 빠른 칩 숨기기
  const chips = document.querySelector(".quick-chips");
  if (chips) chips.style.display = "none";

  // 사용자 메시지 추가
  appendMessage("user", text);

  // 로딩 표시
  isLoading = true;
  if (sendBtn) sendBtn.disabled = true;
  const loadingId = appendLoading();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    const data = await res.json();
    removeLoading(loadingId);

    if (!res.ok || data.error) {
      appendMessage("bot", data.error || "서버 오류가 발생했습니다.", null, true);
    } else {
      appendMessage("bot", data.answer, data.references || []);
    }
  } catch (err) {
    removeLoading(loadingId);
    appendMessage("bot", "네트워크 오류가 발생했습니다. 서버가 실행 중인지 확인해 주세요.", null, true);
  } finally {
    isLoading = false;
    if (sendBtn) sendBtn.disabled = false;
    if (input) input.focus();
  }
}

// ── 말풍선 생성 ───────────────────────────────
function appendMessage(role, text, references, isError) {
  const container = document.getElementById("chat-messages");
  if (!container) return;

  const wrapper = document.createElement("div");
  wrapper.className = `message ${role === "user" ? "user-message" : "bot-message"}`;

  const avatar = document.createElement("div");
  avatar.className = `avatar ${role === "user" ? "user-avatar" : "bot-avatar"}`;
  avatar.textContent = role === "user" ? "👤" : "🏢";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble" + (isError ? " error-bubble" : "");

  // **굵게** 마크다운 변환 + 줄바꿈 처리
  const html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");

  bubble.innerHTML = `<p>${html}</p>`;

  wrapper.appendChild(avatar);

  wrapper.appendChild(bubble);
  container.appendChild(wrapper);
  container.scrollTop = container.scrollHeight;
}

// ── 로딩 도트 ────────────────────────────────
function appendLoading() {
  const container = document.getElementById("chat-messages");
  if (!container) return null;

  const id = "loading-" + Date.now();
  const wrapper = document.createElement("div");
  wrapper.className = "message bot-message loading-message";
  wrapper.id = id;
  wrapper.innerHTML = `
    <div class="avatar bot-avatar">🏢</div>
    <div class="message-bubble">
      <div class="loading-dots"><span></span><span></span><span></span></div>
    </div>`;
  container.appendChild(wrapper);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeLoading(id) {
  if (id) document.getElementById(id)?.remove();
}

// ══════════════════════════════════════════════
// 관리자 페이지 기능
// ══════════════════════════════════════════════

function uploadFile(input) {
  if (input.files && input.files[0]) doUpload(input.files[0]);
}

function onDragOver(e) {
  e.preventDefault();
  document.getElementById("upload-area")?.classList.add("dragover");
}

function onDragLeave() {
  document.getElementById("upload-area")?.classList.remove("dragover");
}

function onDrop(e) {
  e.preventDefault();
  document.getElementById("upload-area")?.classList.remove("dragover");
  const files = e.dataTransfer?.files;
  if (files && files[0]) doUpload(files[0]);
}

async function doUpload(file) {
  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    showUploadResult(false, "엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.");
    return;
  }
  showUploadResult(null, "⏳ 업로드 중...");

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res  = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok || data.error) {
      showUploadResult(false, `❌ ${data.error}`);
    } else {
      showUploadResult(true, `✅ ${data.message}`);
      setTimeout(() => window.location.reload(), 1500);
    }
  } catch {
    showUploadResult(false, "❌ 네트워크 오류가 발생했습니다.");
  }
}

function showUploadResult(success, message) {
  const div = document.getElementById("upload-result");
  if (!div) return;
  div.style.display = "block";
  div.className = "upload-result" + (success === true ? " success" : success === false ? " error" : "");
  div.textContent = message;
}
