"""
rag_engine.py
openpyxl만 사용해서 엑셀 읽기 + custom_qa.json 파일과 연동 (실시간 Q&A 추가/삭제)
"""

import os
import json
from openpyxl import load_workbook

EXCEL_FILENAME = "dormitory_guide_v2.xlsx"
SHEET_NAME = "기숙사_운영_데이터"
CUSTOM_QA_FILENAME = "custom_qa.json"

# 컬럼 순서 (A=카테고리, B=질문, C=답변)
COL_CATEGORY = 0
COL_QUESTION = 1
COL_ANSWER   = 2

# 캐시
_cache = {"data": None, "mtime": None, "mtime_custom": None}


def _get_excel_path():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, EXCEL_FILENAME)


def _get_custom_qa_path():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, CUSTOM_QA_FILENAME)


def load_custom_data() -> list[dict]:
    """custom_qa.json 파일을 안전하게 읽어옵니다."""
    path = _get_custom_qa_path()
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            # 모든 커스텀 항목에 is_custom=True 속성 부여
            for item in data:
                item["is_custom"] = True
            return data
    except Exception as e:
        print(f"[RAG] custom_qa.json 로드 실패: {e}")
        return []


def save_custom_data(data) -> bool:
    """custom_qa.json 파일에 안전하게 데이터를 씁니다. Vercel 환경 에러 무시."""
    path = _get_custom_qa_path()
    try:
        # 저장할 때는 속성 정제
        clean_data = []
        for item in data:
            clean_data.append({
                "category": item.get("category", "기타").strip(),
                "question": item.get("question", "").strip(),
                "answer": item.get("answer", "").strip(),
                "is_custom": True
            })
        with open(path, "w", encoding="utf-8") as f:
            json.dump(clean_data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"[RAG WARNING] custom_qa.json 저장 실패 (읽기 전용 환경일 수 있음): {e}")
        return False


def load_data() -> list[dict]:
    """엑셀 파일과 커스텀 JSON 파일을 읽어 Q&A 리스트로 병합 반환. 파일 변경 시 자동 갱신."""
    global _cache
    excel_path = _get_excel_path()
    custom_path = _get_custom_qa_path()

    excel_mtime = os.path.getmtime(excel_path) if os.path.exists(excel_path) else 0
    custom_mtime = os.path.getmtime(custom_path) if os.path.exists(custom_path) else 0

    if (_cache["data"] is None or 
        _cache["mtime"] != excel_mtime or 
        _cache["mtime_custom"] != custom_mtime):
        
        # 1) 기본 엑셀 데이터 읽기
        excel_data = []
        if os.path.exists(excel_path):
            try:
                wb = load_workbook(excel_path, read_only=True, data_only=True)
                ws = wb[SHEET_NAME]
                rows = list(ws.iter_rows(values_only=True))
                wb.close()

                for row in rows[1:]:  # 첫 행은 헤더
                    if len(row) < 3:
                        continue
                    cat = str(row[COL_CATEGORY]).strip() if row[COL_CATEGORY] else "기타"
                    q   = str(row[COL_QUESTION]).strip() if row[COL_QUESTION] else ""
                    a   = str(row[COL_ANSWER]).strip()   if row[COL_ANSWER]   else ""
                    if q and a and cat != "None":
                        excel_data.append({
                            "category": cat,
                            "question": q,
                            "answer": a,
                            "is_custom": False
                        })
            except Exception as e:
                print(f"[RAG] 엑셀 읽기 중 오류 발생: {e}")
        else:
            print(f"[RAG WARNING] 엑셀 파일을 찾을 수 없습니다: {excel_path}")

        # 2) 커스텀 JSON 데이터 읽기
        custom_data = load_custom_data()

        # 3) 데이터 병합 및 캐싱
        _cache["data"] = excel_data + custom_data
        _cache["mtime"] = excel_mtime
        _cache["mtime_custom"] = custom_mtime
        print(f"[RAG] Loaded {len(excel_data)} items from Excel and {len(custom_data)} items from JSON")

    return _cache["data"]


def get_categories() -> list:
    data = load_data()
    seen = []
    for item in data:
        if item["category"] not in seen:
            seen.append(item["category"])
    return seen


def search(query: str, top_k: int = 3) -> list[dict]:
    """질문과 가장 관련 있는 Q&A top_k개 반환."""
    data = load_data()
    if not data:
        return []

    query_lower = query.lower()

    scores = []
    for item in data:
        q_text   = item["question"].lower()
        a_text   = item["answer"].lower()
        combined = q_text + " " + a_text

        # 2글자 이상 슬라이딩 부분 문자열 매칭
        char_score = 0
        for length in range(2, min(len(query_lower) + 1, 8)):
            for i in range(len(query_lower) - length + 1):
                sub = query_lower[i:i + length]
                if sub in combined:
                    char_score += length

        scores.append((char_score, item))

    # 점수 내림차순 정렬 후 상위 k개
    scores.sort(key=lambda x: x[0], reverse=True)
    results = [item for score, item in scores[:top_k] if score > 0]
    return results


def get_all_qa() -> list[dict]:
    return load_data()


def add_custom_qa(category, question, answer) -> bool:
    """커스텀 Q&A를 추가합니다."""
    data = load_custom_data()
    
    # 중복 질문이 있다면 덮어쓰기
    updated = False
    for item in data:
        if item["question"].strip() == question.strip():
            item["category"] = category.strip()
            item["answer"] = answer.strip()
            updated = True
            break
            
    if not updated:
        data.append({
            "category": category.strip(),
            "question": question.strip(),
            "answer": answer.strip(),
            "is_custom": True
        })
        
    success = save_custom_data(data)
    reload()
    return success


def delete_custom_qa(question_text) -> bool:
    """커스텀 Q&A를 삭제합니다."""
    data = load_custom_data()
    original_len = len(data)
    
    # 일치하지 않는 것만 남기고 필터링
    data = [item for item in data if item["question"].strip() != question_text.strip()]
    
    if len(data) == original_len:
        return False
        
    success = save_custom_data(data)
    reload()
    return success


def reload():
    global _cache
    _cache = {"data": None, "mtime": None, "mtime_custom": None}
    load_data()
    print("[RAG] Cache refreshed")
