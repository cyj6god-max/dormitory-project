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
let _doughnutChart = null;

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
    const catList   = data.categories || [];

    // ── 테이블 렌더링 (최신순) ──
    if (statsList.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: #718096; padding: 20px;">📭 최근 3개월간 기록된 질문 내역이 없습니다.</td></tr>`;
    } else {
      let html = "";
      // 날짜 역순으로 테이블에 표시
      [...statsList].reverse().forEach(item => {
        html += `<tr>
          <td style="font-weight: 500; color: #2d3748;">📅 ${item.date}</td>
          <td style="text-align: center; font-weight: bold; color: #2b6cb0;">${item.count} 회</td>
        </tr>`;
      });
      tableBody.innerHTML = html;
    }

    // ── Chart.js 렌더링 ──
    if (statsList.length > 0 || catList.length > 0) {
      document.getElementById("charts-area").style.display = "block";

      // 차트 색상 팔레트
      const palette = [
        "#ff748c","#4a9eff","#48bb78","#ed8936","#9f7aea",
        "#38b2ac","#fc8181","#63b3ed","#68d391","#f6ad55"
      ];

      // 색상을 어둡게 만드는 헬퍼 (3D 깊이 레이어용)
      function _darken(hex, factor) {
        const r = parseInt(hex.slice(1,3),16);
        const g = parseInt(hex.slice(3,5),16);
        const b = parseInt(hex.slice(5,7),16);
        const d = v => Math.round(v * factor).toString(16).padStart(2,"0");
        return `#${d(r)}${d(g)}${d(b)}`;
      }

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

      // ── ECharts 3D 도넛 차트 (레이어 스태킹 기법) ──
      const doughDom = document.getElementById("doughnut3DChart");
      if (doughDom && catList.length > 0) {
        if (_doughnutChart) { _doughnutChart.dispose(); }
        _doughnutChart = echarts.init(doughDom);

        const pieData = catList.map((c, i) => ({
          value: c.count,
          name: c.category,
          itemStyle: { color: palette[i % palette.length] }
        }));

        // 3D 입체감을 위한 다중 레이어 (아래→위 순서)
        const LAYERS = 10;
        const BASE_Y  = 56;      // 기준 중심 Y (%)
        const STEP    = 1.2;     // 레이어 간격 (%)
        const series  = [];

        // ── 깊이 레이어 (어두운 색으로 두께 표현) ──
        for (let i = LAYERS; i >= 1; i--) {
          series.push({
            type: "pie",
            radius: ["30%", "56%"],
            center: ["42%", `${BASE_Y + i * STEP}%`],
            animation: false,
            label: { show: false },
            labelLine: { show: false },
            emphasis: { disabled: true },
            itemStyle: { opacity: 0.18 },
            data: pieData.map(d => ({
              value: d.value,
              name: d.name,
              itemStyle: { color: _darken(d.itemStyle.color, 0.55) }
            }))
          });
        }

        // ── 최상단 메인 파이 (밝은 색 + 그림자) ──
        series.push({
          type: "pie",
          radius: ["30%", "56%"],
          center: ["42%", `${BASE_Y}%`],
          itemStyle: {
            shadowBlur: 20,
            shadowColor: "rgba(0,0,0,0.25)",
            shadowOffsetY: 8,
            borderWidth: 1.5,
            borderColor: "#fff"
          },
          label: {
            show: true,
            position: "outside",
            formatter: "{b}\n{d}%",
            fontSize: 11,
            color: "#4a5568",
            fontWeight: "600"
          },
          labelLine: { smooth: 0.4, length: 8, length2: 6 },
          emphasis: {
            itemStyle: { shadowBlur: 30, shadowColor: "rgba(0,0,0,0.35)" },
            scaleSize: 6
          },
          data: pieData
        });

        _doughnutChart.setOption({
          backgroundColor: "transparent",
          tooltip: {
            trigger: "item",
            formatter: "{b}<br/>질문 수: <b>{c}건</b> ({d}%)",
            backgroundColor: "rgba(255,255,255,0.95)",
            borderColor: "#ffd0d6",
            textStyle: { color: "#4a3a3c", fontSize: 12 }
          },
          legend: {
            orient: "vertical",
            right: "2%",
            top: "middle",
            itemWidth: 10,
            itemHeight: 10,
            itemGap: 10,
            textStyle: { fontSize: 11, color: "#4a5568" }
          },
          series
        });

        // 창 크기 변경 시 차트 리사이즈
        window.addEventListener("resize", () => _doughnutChart && _doughnutChart.resize());
      }
    }

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
