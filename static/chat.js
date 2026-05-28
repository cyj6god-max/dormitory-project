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

  let cleanText = text;
  let tagsHTML = "";

  // 태그 파싱 (예: "태그: #생활수칙 #벌점")
  const tagRegex = /태그\s*:\s*(#[^\n\r]+)/i;
  const match = text.match(tagRegex);
  if (match) {
    cleanText = text.replace(tagRegex, "").trim();
    const tagsStr = match[1];
    const tagsList = tagsStr.split(/\s+/).filter(t => t.startsWith("#"));
    
    tagsHTML = `<div class="msg-tags">`;
    tagsList.forEach(tag => {
      // 태그 클릭 시 # 제거하고 검색어로 전송
      const searchText = tag.replace(/^#/, '');
      tagsHTML += `<span class="tag-chip" title="${searchText} 관련 질문 검색" style="cursor:pointer;" onclick="sendQuick('${searchText.replace(/'/g, "\\'")} 관련 안내 알려줘')">${tag}</span>`;
    });
    tagsHTML += `</div>`;
  }

  // **굵게** 마크다운 변환 + 줄바꿈 처리
  const html = cleanText
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");

  bubble.innerHTML = `<p>${html}</p>${tagsHTML}`;

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

// 3. 질문 일별 통계 로드 + Chart.js 차트 렌더링
let _lineChart = null;
let _doughnutChart = null; // Chart.js 객체 저장 (카테고리 가로 막대 그래프)

async function loadDailyStats() {
  const tableBody = document.getElementById("stats-table-body");
  if (!tableBody) return;
  
  // 날짜 인풋 및 필터 처리
  const startInput = document.getElementById("stats-start-date");
  const endInput = document.getElementById("stats-end-date");
  
  if (startInput && endInput) {
    const today = new Date();
    // 로컬 시간대를 기준으로 오늘 날짜 구하기 (KST 반영)
    const offset = today.getTimezoneOffset() * 60000;
    const todayStr = new Date(today.getTime() - offset).toISOString().split('T')[0];
    
    // 3개월 전 날짜 계산
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(today.getMonth() - 3);
    const minDateStr = new Date(threeMonthsAgo.getTime() - offset).toISOString().split('T')[0];
    
    // 달력 날짜 선택 제한 (최대 오늘, 최소 3개월 전)
    startInput.min = minDateStr;
    startInput.max = todayStr;
    endInput.min = minDateStr;
    endInput.max = todayStr;
    
    // 값이 없을 경우 기본값으로 최근 30일 설정
    if (!startInput.value || !endInput.value) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      const thirtyDaysAgoStr = new Date(thirtyDaysAgo.getTime() - offset).toISOString().split('T')[0];
      
      startInput.value = thirtyDaysAgoStr;
      endInput.value = todayStr;
    }
  }
  
  const startDate = startInput ? startInput.value : "";
  const endDate = endInput ? endInput.value : "";
  
  if (startDate && endDate) {
    const sDiff = new Date(startDate);
    const eDiff = new Date(endDate);
    const diffDays = Math.ceil(Math.abs(eDiff - sDiff) / (1000 * 60 * 60 * 24));
    if (diffDays > 92) {
      alert("❌ 조회 기간은 최대 3개월(92일)까지 설정할 수 있습니다.");
      return;
    }
    if (eDiff < sDiff) {
      alert("❌ 시작일은 종료일보다 이전 날짜여야 합니다.");
      return;
    }
  }
  
  try {
    const url = `/api/logs/daily?start_date=${startDate}&end_date=${endDate}`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (!res.ok || !data.success) {
      tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #c53030; padding: 20px;">❌ 데이터를 불러오지 못했습니다: ${data.error || "알 수 없는 오류"}</td></tr>`;
      return;
    }
    
    const statsList = data.data || [];
    const catList   = data.categories || [];
    
    // 상단 '전체 이력 다운로드' 버튼의 링크도 필터 일정에 맞게 동적 업데이트
    const globalDl = document.getElementById("global-download-btn");
    if (globalDl) {
      globalDl.href = `/api/logs/download?start_date=${startDate}&end_date=${endDate}`;
    }

    // ── 테이블 렌더링 (최신순) ──
    if (statsList.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #718096; padding: 20px;">📭 선택한 기간에 기록된 질문 내역이 없습니다.</td></tr>`;
    } else {
      let html = "";
      // 날짜 역순으로 테이블에 표시
      [...statsList].reverse().forEach((item) => {
        const dateId = item.date;
        
        // 상세 질문 행 렌더링
        let questionsHtml = "";
        if (item.questions && item.questions.length > 0) {
          questionsHtml = `
            <tr id="entries-${dateId}" style="display: none; background: #fff5f6;">
              <td colspan="4" style="padding: 15px 20px; border-bottom: 1px solid var(--border);">
                <div style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; background: white; box-shadow: inset 0 2px 8px rgba(0,0,0,0.05);">
                  <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                    <thead>
                      <tr style="background: var(--bg-elevated); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 1;">
                        <th style="padding: 10px; width: 85px; color: var(--text-secondary); font-weight: 600;">⏰ 시간</th>
                        <th style="padding: 10px; width: 100px; color: var(--text-secondary); font-weight: 600;">🏷️ 카테고리</th>
                        <th style="padding: 10px; color: var(--text-secondary); font-weight: 600;">💬 질문</th>
                        <th style="padding: 10px; color: var(--text-secondary); font-weight: 600;">🤖 답변</th>
                        <th style="padding: 10px; width: 60px; text-align: center; color: var(--text-secondary); font-weight: 600;">결과</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${item.questions.map(q => {
                        const timeStr = q.timestamp.split(" ")[1];
                        const foundBadge = q.found 
                          ? `<span style="color: #3fb950; font-weight: 600; background: rgba(63,185,80,0.12); padding: 2px 6px; border-radius: 4px; font-size: 11px;">적합</span>` 
                          : `<span style="color: #ff5c5c; font-weight: 600; background: rgba(255,92,92,0.12); padding: 2px 6px; border-radius: 4px; font-size: 11px;">부적합</span>`;
                        return `
                          <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 10px; color: var(--text-muted); font-family: monospace;">${timeStr}</td>
                            <td style="padding: 10px;"><span class="cat-tag" style="padding: 2px 7px; font-size: 10px;">${q.category}</span></td>
                            <td style="padding: 10px; color: var(--text-primary); font-weight: 500; word-break: break-all;">${q.query}</td>
                            <td style="padding: 10px; color: var(--text-secondary); word-break: break-all; max-height: 80px; overflow-y: auto;">${q.answer}</td>
                            <td style="padding: 10px; text-align: center; vertical-align: middle;">${foundBadge}</td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          `;
        } else {
          questionsHtml = `
            <tr id="entries-${dateId}" style="display: none; background: #fff5f6;">
              <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 15px;">상세 질문 이력이 없습니다.</td>
            </tr>
          `;
        }

        html += `
          <tr id="row-${dateId}">
            <td style="font-weight: 500; color: #2d3748; vertical-align: middle;">📅 ${item.date}</td>
            <td style="text-align: center; font-weight: bold; color: #2b6cb0; vertical-align: middle;">${item.count} 회</td>
            <td style="text-align: center; vertical-align: middle;">
              <button type="button" class="admin-btn" style="padding: 4px 12px; font-size: 12px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 4px;" onclick="toggleDayEntries('${dateId}')" id="toggle-btn-${dateId}">👁️ 목록 보기</button>
            </td>
            <td style="text-align: center; vertical-align: middle;">
              <a href="/api/logs/download?start_date=${item.date}&end_date=${item.date}" class="admin-btn secondary-btn" style="padding: 4px 10px; font-size: 12px; display: inline-flex; align-items: center; gap: 3px; text-decoration: none; border-radius: 4px;">📥 받기</a>
            </td>
          </tr>
          ${questionsHtml}
        `;
      });
      tableBody.innerHTML = html;
    }

    // ── Chart.js 렌더링 ──
    if (statsList.length > 0 || catList.length > 0) {
      document.getElementById("charts-area").style.display = "block";

      const palette = [
        "#ff748c", "#4a9eff", "#48bb78", "#ed8936", "#9f7aea",
        "#38b2ac", "#fc8181", "#63b3ed", "#68d391", "#f6ad55"
      ];

      // ── 꺾은선 차트 (일별 추이) ──
      const lineCtx = document.getElementById("lineChart")?.getContext("2d");
      if (lineCtx) {
        if (_lineChart) _lineChart.destroy();
        _lineChart = new Chart(lineCtx, {
          type: "line",
          data: {
            labels: statsList.map(d => d.date.slice(5)), // MM-DD만 표시
            datasets: [{
              label: "질문 건수",
              data: statsList.map(d => d.count),
              borderColor: "#ff748c",
              backgroundColor: "rgba(255,116,140,0.12)",
              borderWidth: 2.5,
              pointBackgroundColor: "#ff748c",
              pointRadius: 4,
              pointHoverRadius: 6,
              fill: true,
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y}건` } }
            },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 11 } } },
              y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } } }
            }
          }
        });
      }

      // ── 가로 막대 차트 (카테고리별 분포) ──
      const catCtx = document.getElementById("categoryChart")?.getContext("2d");
      if (catCtx) {
        if (_doughnutChart) {
          if (typeof _doughnutChart.destroy === 'function') {
            _doughnutChart.destroy();
          }
        }
        
        _doughnutChart = new Chart(catCtx, {
          type: "bar",
          data: {
            labels: catList.map(c => c.category),
            datasets: [{
              label: "질문 건수",
              data: catList.map(c => c.count),
              backgroundColor: catList.map((c, i) => palette[i % palette.length]),
              borderRadius: 6,
              borderWidth: 0,
              barThickness: 16
            }]
          },
          options: {
            indexAxis: 'y', // 가로 막대 그래프 설정
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x}건` } }
            },
            scales: {
              x: { 
                beginAtZero: true, 
                ticks: { stepSize: 1, font: { size: 11 } },
                grid: { color: "rgba(0,0,0,0.05)" }
              },
              y: { 
                grid: { display: false }, 
                ticks: { font: { size: 11, weight: '600' } } 
              }
            }
          }
        });
      }
    } else {
      document.getElementById("charts-area").style.display = "none";
    }

  } catch (err) {
    console.error(err);
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #c53030; padding: 20px;">❌ 통계를 로드하는 중 네트워크 오류가 발생했습니다.</td></tr>`;
  }
}

// ── 상세 펼치기/접기 (Accordion) ──
function toggleDayEntries(dateId) {
  const targetRow = document.getElementById(`entries-${dateId}`);
  const btn = document.getElementById(`toggle-btn-${dateId}`);
  if (!targetRow) return;
  
  if (targetRow.style.display === "none") {
    targetRow.style.display = "table-row";
    if (btn) {
      btn.textContent = "접기";
      btn.style.background = "var(--border)";
      btn.style.color = "var(--text-primary)";
    }
  } else {
    targetRow.style.display = "none";
    if (btn) {
      btn.textContent = "👁️ 목록 보기";
      btn.style.background = "var(--bg-elevated)";
      btn.style.color = "var(--text-secondary)";
    }
  }
}

// ── 필터 버튼 조작 ──
function onSearchStats() {
  loadDailyStats();
}

// ── 필터 선택 기간 다운로드 ──
function onDownloadFilteredLogs() {
  const startInput = document.getElementById("stats-start-date");
  const endInput = document.getElementById("stats-end-date");
  const start = startInput ? startInput.value : "";
  const end = endInput ? endInput.value : "";
  
  if (!start || !end) {
    alert("❌ 시작일과 종료일을 모두 선택해 주세요.");
    return;
  }
  
  const sDiff = new Date(start);
  const eDiff = new Date(end);
  const diffDays = Math.ceil(Math.abs(eDiff - sDiff) / (1000 * 60 * 60 * 24));
  if (diffDays > 92) {
    alert("❌ 조회 기간은 최대 3개월(92일)까지 설정할 수 있습니다.");
    return;
  }
  if (eDiff < sDiff) {
    alert("❌ 시작일은 종료일보다 이전 날짜여야 합니다.");
    return;
  }
  
  window.location.href = `/api/logs/download?start_date=${start}&end_date=${end}`;
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
