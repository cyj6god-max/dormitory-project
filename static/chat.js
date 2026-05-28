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
// 관리자 페이지 기능 (실시간 Q&A 관리 및 로그)
// ══════════════════════════════════════════════

// 1. Q&A 직접 추가
async function submitNewQa() {
  const catInput = document.getElementById("qa-category");
  const qInput = document.getElementById("qa-question");
  const aInput = document.getElementById("qa-answer");
  const resultDiv = document.getElementById("add-result");
  
  if (!catInput || !qInput || !aInput || !resultDiv) return;
  
  const category = catInput.value.trim();
  const question = qInput.value.trim();
  const answer = aInput.value.trim();
  
  resultDiv.style.display = "none";
  resultDiv.className = "add-result-msg";
  resultDiv.textContent = "";
  
  if (!category || !question || !answer) {
    resultDiv.style.display = "block";
    resultDiv.className = "add-result-msg error";
    resultDiv.style.background = "#fff5f5";
    resultDiv.style.color = "#c53030";
    resultDiv.textContent = "❌ 모든 항목(카테고리, 질문, 답변)을 입력해 주세요.";
    return;
  }
  
  try {
    const res = await fetch("/api/qa/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, question, answer })
    });
    
    const data = await res.json();
    resultDiv.style.display = "block";
    
    if (!res.ok || data.error) {
      resultDiv.className = "add-result-msg error";
      resultDiv.style.background = "#fff5f5";
      resultDiv.style.color = "#c53030";
      resultDiv.textContent = `❌ 오류: ${data.error || "추가 실패"}`;
    } else {
      resultDiv.className = "add-result-msg success";
      resultDiv.style.background = "#f0fff4";
      resultDiv.style.color = "#22543d";
      resultDiv.textContent = `✅ ${data.message}`;
      
      // 폼 비우기
      catInput.value = "";
      qInput.value = "";
      aInput.value = "";
      
      // 1.5초 후 목록 갱신
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  } catch (err) {
    resultDiv.style.display = "block";
    resultDiv.className = "add-result-msg error";
    resultDiv.style.background = "#fff5f5";
    resultDiv.style.color = "#c53030";
    resultDiv.textContent = "❌ 네트워크 오류가 발생했습니다.";
  }
}

// 2. Q&A 삭제 (실시간 반영)
async function deleteQa(buttonEl, rowIndex) {
  const questionText = buttonEl.getAttribute("data-question");
  if (!questionText) return;
  
  if (!confirm(`정말 이 질문을 삭제하시겠습니까?\n\n질문: "${questionText}"`)) {
    return;
  }
  
  try {
    const res = await fetch("/api/qa/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: questionText })
    });
    
    const data = await res.json();
    
    if (!res.ok || data.error) {
      alert(`❌ 삭제 실패: ${data.error || "오류 발생"}`);
    } else {
      // 1) 화면에서 해당 행 삭제
      const row = document.getElementById(`qa-row-${rowIndex}`);
      if (row) row.remove();
      
      // 2) 총 개수 뱃지 숫자 갱신
      const totalBadge = document.getElementById("total-badge");
      if (totalBadge) {
        const currentCount = parseInt(totalBadge.textContent.replace(/[^0-9]/g, "")) || 0;
        if (currentCount > 0) {
          totalBadge.textContent = `총 ${currentCount - 1}개`;
        }
      }
      
      alert("✅ 삭제가 완료되었습니다.");
    }
  } catch (err) {
    alert("❌ 네트워크 오류로 인해 삭제에 실패했습니다.");
  }
}

// 3. 질문 일별 통계 로드
async function loadDailyStats() {
  const tableBody = document.getElementById("stats-table-body");
  if (!tableBody) return;
  
  try {
    const res = await fetch("/api/logs/daily");
    const data = await res.json();
    
    if (!res.ok || !data.success) {
      tableBody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: #c53030; padding: 20px;">❌ 데이터를 불러오지 못했습니다.</td></tr>`;
      return;
    }
    
    const statsList = data.data || [];
    if (statsList.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: #718096; padding: 20px;">📭 최근 3개월간 기록된 질문 내역이 없습니다.</td></tr>`;
      return;
    }
    
    let html = "";
    statsList.forEach(item => {
      html += `
        <tr>
          <td style="font-weight: 500; color: #2d3748;">📅 ${item.date}</td>
          <td style="text-align: center; font-weight: bold; color: #2b6cb0;">${item.count} 회</td>
        </tr>
      `;
    });
    tableBody.innerHTML = html;
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: #c53030; padding: 20px;">❌ 네트워크 오류로 통계를 가져오지 못했습니다.</td></tr>`;
  }
}

// 4. Q&A 엑셀 파일 업로드
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
    const res  = await fetch("/api/qa/upload", { method: "POST", body: formData });
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
  
  if (success === true) {
    div.style.background = "#f0fff4";
    div.style.color = "#22543d";
  } else if (success === false) {
    div.style.background = "#fff5f5";
    div.style.color = "#c53030";
  } else {
    div.style.background = "#ebf8ff";
    div.style.color = "#2b6cb0";
  }
  
  div.textContent = message;
}

// 5. Q&A 수정 모달 제어
function openEditModal(buttonEl) {
  const category = buttonEl.getAttribute("data-category") || "";
  const question = buttonEl.getAttribute("data-question") || "";
  const answer = buttonEl.getAttribute("data-answer") || "";

  document.getElementById("edit-old-question").value = question;
  document.getElementById("edit-category").value = category;
  document.getElementById("edit-question").value = question;
  document.getElementById("edit-answer").value = answer;

  const errDiv = document.getElementById("edit-modal-error");
  if (errDiv) {
    errDiv.style.display = "none";
    errDiv.textContent = "";
  }

  document.getElementById("edit-qa-modal").style.display = "flex";
}

function closeEditModal() {
  document.getElementById("edit-qa-modal").style.display = "none";
}

async function submitEditQa() {
  const oldQuestion = document.getElementById("edit-old-question").value.trim();
  const category = document.getElementById("edit-category").value.trim();
  const question = document.getElementById("edit-question").value.trim();
  const answer = document.getElementById("edit-answer").value.trim();
  const errDiv = document.getElementById("edit-modal-error");

  if (errDiv) {
    errDiv.style.display = "none";
    errDiv.textContent = "";
  }

  if (!category || !question || !answer) {
    if (errDiv) {
      errDiv.textContent = "❌ 모든 항목(카테고리, 질문, 답변)을 입력해 주세요.";
      errDiv.style.display = "block";
    }
    return;
  }

  try {
    const res = await fetch("/api/qa/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        old_question: oldQuestion,
        category: category,
        question: question,
        answer: answer
      })
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      if (errDiv) {
        errDiv.textContent = `❌ 오류: ${data.error || "수정 실패"}`;
        errDiv.style.display = "block";
      }
    } else {
      alert("✅ 수정이 완료되었습니다.");
      closeEditModal();
      window.location.reload();
    }
  } catch (err) {
    if (errDiv) {
      errDiv.textContent = "❌ 네트워크 오류가 발생했습니다.";
      errDiv.style.display = "block";
    }
  }
}
