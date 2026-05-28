"""
rag_engine.py
openpyxl만 사용해서 엑셀 읽기 (pandas/pyarrow 충돌 회피)
"""

import os
from openpyxl import load_workbook

EXCEL_FILENAME = "dormitory_guide_v2.xlsx"
SHEET_NAME = "기숙사_운영_데이터"

# 컬럼 순서 (A=카테고리, B=질문, C=답변)
COL_CATEGORY = 0
COL_QUESTION = 1
COL_ANSWER   = 2

# 캐시
_cache = {"data": None, "mtime": None}


def _get_excel_path():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, EXCEL_FILENAME)


def load_data() -> list[dict]:
    """엑셀 파일을 읽어 Q&A 리스트로 반환. 파일 변경 시 자동 갱신."""
    global _cache
    path = _get_excel_path()

    if not os.path.exists(path):
        raise FileNotFoundError(f"엑셀 파일을 찾을 수 없습니다: {path}")

    mtime = os.path.getmtime(path)
    if _cache["data"] is None or _cache["mtime"] != mtime:
        wb = load_workbook(path, read_only=True, data_only=True)
        ws = wb[SHEET_NAME]
        rows = list(ws.iter_rows(values_only=True))
        wb.close()

        data = []
        for row in rows[1:]:  # 첫 행은 헤더
            if len(row) < 3:
                continue
            cat = str(row[COL_CATEGORY]).strip() if row[COL_CATEGORY] else "기타"
            q   = str(row[COL_QUESTION]).strip() if row[COL_QUESTION] else ""
            a   = str(row[COL_ANSWER]).strip()   if row[COL_ANSWER]   else ""
            if q and a and cat != "None":
                data.append({"category": cat, "question": q, "answer": a})

        _cache["data"]  = data
        _cache["mtime"] = mtime
        print(f"[RAG] Excel loaded: {len(data)} Q&A items")

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


def reload():
    global _cache
    _cache = {"data": None, "mtime": None}
    load_data()
    print("[RAG] Cache refreshed")
