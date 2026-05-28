"""
app.py — 기숙사 챗봇 Flask 웹 서버 (카테고리 필터 제거, 채팅 전용)
"""

import sys
import os
import shutil

# Windows 콘솔 인코딩 강제 UTF-8 설정
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass
os.environ.setdefault('PYTHONUTF8', '1')

from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from dotenv import load_dotenv
from openai import OpenAI
import rag_engine
import json

load_dotenv()

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024
app.config["JSON_AS_ASCII"] = False  # 한국어 JSON 응답 깨짐 방지
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dormitory_secret_key_12345")

api_key = os.getenv("OPENAI_API_KEY")
client = None
if api_key:
    try:
        client = OpenAI(api_key=api_key)
    except Exception as e:
        print(f"OpenAI Client 생성 실패: {e}")

EXCEL_FILENAME = "dormitory_guide_v2.xlsx"
CONFIG_FILE = "admin_config.json"

def get_admin_password():
    if not os.path.exists(CONFIG_FILE):
        return "8002"
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("password", "8002")
    except:
        return "8002"

def save_admin_password(new_password):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump({"password": new_password}, f)


# ── 페이지 ──────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/admin")
def admin():
    if not session.get("admin_logged_in"):
        return redirect(url_for("admin_login"))
    qa_list = rag_engine.get_all_qa()
    return render_template("admin.html", qa_list=qa_list, total=len(qa_list))


@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    if session.get("admin_logged_in"):
        return redirect(url_for("admin"))
    
    error = None
    if request.method == "POST":
        password = request.form.get("password", "").strip()
        correct_password = get_admin_password()
        if password == correct_password:
            session["admin_logged_in"] = True
            return redirect(url_for("admin"))
        else:
            error = "비밀번호가 올바르지 않습니다."
            
    return render_template("login.html", error=error)


@app.route("/admin/logout")
def admin_logout():
    session.pop("admin_logged_in", None)
    return redirect(url_for("admin_login"))


@app.route("/admin/change-password", methods=["POST"])
def change_password():
    if not session.get("admin_logged_in"):
        return jsonify({"error": "로그인이 필요합니다."}), 401
        
    data = request.get_json()
    if not data:
        return jsonify({"error": "올바르지 않은 요청 데이터입니다."}), 400
        
    current_pwd = data.get("current_password", "").strip()
    new_pwd = data.get("new_password", "").strip()
    
    if not current_pwd or not new_pwd:
        return jsonify({"error": "현재 비밀번호와 새 비밀번호를 모두 입력해 주세요."}), 400
        
    if current_pwd != get_admin_password():
        return jsonify({"error": "현재 비밀번호가 일치하지 않습니다."}), 400
        
    save_admin_password(new_pwd)
    session.pop("admin_logged_in", None)
    return jsonify({"success": True, "message": "비밀번호가 성공적으로 변경되었습니다. 다시 로그인해 주세요."})


@app.route("/admin/find-password", methods=["POST"])
def find_password():
    data = request.get_json()
    if not data:
        return jsonify({"error": "올바르지 않은 요청 데이터입니다."}), 400
        
    name = data.get("name", "").strip()
    init_pwd = data.get("init_password", "").strip()
    
    if not name or not init_pwd:
        return jsonify({"error": "이름과 초기 비밀번호를 모두 입력해 주세요."}), 400
        
    if name == "채유진" and init_pwd == "8002":
        current_password = get_admin_password()
        return jsonify({"success": True, "password": current_password})
    else:
        return jsonify({"error": "관리자 정보가 일치하지 않습니다."}), 400


# ── API ──────────────────────────────────────────

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    if not data or not data.get("message", "").strip():
        return jsonify({"error": "질문을 입력해 주세요."}), 400

    user_message = data["message"].strip()

    # 1) 엑셀에서 관련 Q&A 검색
    results = rag_engine.search(user_message, top_k=3)

    # 2) 관련 내용이 없으면 자료 없음 안내
    if not results:
        return jsonify({
            "answer": "적절한 답변을 찾지 못했습니다. 관리자에게 문의해 주세요. (소통폰 : 010-2629-8002)",
            "references": [],
            "found": False,
        })

    # 3) 찾은 내용을 컨텍스트로 GPT에 전달
    context_text = ""
    for i, r in enumerate(results, 1):
        context_text += f"\n[자료 {i}] 카테고리: {r['category']}\n질문: {r['question']}\n답변: {r['answer']}\n"

    system_prompt = """당신은 기숙사 거주자의 질문에 답변하는 도우미입니다.
반드시 아래 규칙을 따르세요:
1. 아래 '기숙사 안내 자료'의 내용만을 참고해서 답변하세요.
2. 자료에 없는 내용은 절대 추측하거나 지어내지 마세요.
3. 자료에 답변이 없으면 "적절한 답변을 찾지 못했습니다. 관리자에게 문의해 주세요. (소통폰 : 010-2629-8002)"라고만 말하세요.
4. 답변은 친절하고 명확하게 한국어로 작성하세요.
5. 중요한 수치(날짜, 시간, 벌점 등)는 정확히 그대로 인용하세요."""

    user_prompt = f"""기숙사 안내 자료:
{context_text}

거주자 질문: {user_message}

위 자료를 바탕으로 질문에 답변해 주세요."""

    try:
        if not client:
            return jsonify({"error": "OpenAI API 키가 설정되지 않았거나 올바르지 않습니다. 버셀 설정에서 환경 변수를 등록해 주세요."}), 500
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            max_tokens=500,
        )
        answer = response.choices[0].message.content.strip()
    except Exception as e:
        return jsonify({"error": f"AI 서버 오류: {str(e)}"}), 500

    references = [{"category": r["category"], "question": r["question"]} for r in results]
    return jsonify({"answer": answer, "references": references, "found": True})


@app.route("/api/upload", methods=["POST"])
def upload_excel():
    if "file" not in request.files:
        return jsonify({"error": "파일이 없습니다."}), 400

    file = request.files["file"]
    if not file.filename or not file.filename.endswith((".xlsx", ".xls")):
        return jsonify({"error": "엑셀 파일(.xlsx, .xls)만 업로드 가능합니다."}), 400

    base_dir = os.path.dirname(os.path.abspath(__file__))
    save_path = os.path.join(base_dir, EXCEL_FILENAME)
    temp_path = save_path + ".tmp.xlsx"
    backup_path = save_path + ".bak"

    # 1) 임시 파일로 먼저 저장
    try:
        file.save(temp_path)
    except PermissionError:
        return jsonify({"error": "저장 권한 오류입니다. 엑셀이 다른 프로그램에 열려 있다면 닫고 다시 시도해 주세요."}), 500
    except Exception as e:
        return jsonify({"error": f"파일 저장 오류: {str(e)}"}), 500

    # 2) 임시 파일의 엑셀 구조가 올바른지 확인
    try:
        from openpyxl import load_workbook
        wb = load_workbook(temp_path, read_only=True, data_only=True)
        ws = wb["기숙사_운영_데이터"]
        wb.close()
    except Exception as e:
        os.remove(temp_path)
        return jsonify({"error": f"엑셀 파일 형식 오류: 시트 이름이 '기숙사_운영_데이터'인지 확인해 주세요. ({str(e)})"}), 400

    # 3) 기존 파일 백업 후 원자적 교체
    try:
        if os.path.exists(save_path):
            shutil.copy2(save_path, backup_path)
        os.replace(temp_path, save_path)
    except PermissionError:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({"error": "기존 파일 교체에 실패했습니다. 엑셀 프로그램을 닫고 다시 시도해 주세요."}), 500

    # 4) 캐시 갱신
    try:
        rag_engine.reload()
        count = len(rag_engine.get_all_qa())
        return jsonify({"success": True, "message": f"업로드 완료! 총 {count}개의 Q&A가 로드되었습니다.", "count": count})
    except Exception as e:
        if os.path.exists(backup_path):
            shutil.copy2(backup_path, save_path)
            rag_engine.reload()
        return jsonify({"error": f"파일 처리 오류: {str(e)}"}), 500



if __name__ == "__main__":
    print("=" * 50)
    print("  기숙사 챗봇 서버 시작")
    print("  거주자 화면: http://localhost:5000")
    print("  관리자 화면: http://localhost:5000/admin")
    print("=" * 50)
    app.run(debug=True, host="0.0.0.0", port=5000)
