"""Tab 2 bulk upload: a text-only Excel template for chapters, rules, sections,
sub-sections, assessment questions, SOPs and process actions.

Flow: download template -> fill -> check (nothing saved, errors listed) ->
save (all or nothing). Existing chapters / rules / sections / questions are
matched and kept as they are; only new items are added."""
import io
import json
import re

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from openpyxl import Workbook, load_workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Font, PatternFill
from sqlalchemy.orm import Session

from app.core.deps import get_current_super_admin
from app.database.connection import get_db
from app.models.super_admin import SuperAdmin
from app.models.tab1_models import MasterRegistry, MasterRegistryItem
from app.models.tab2_models import LegalChapter, LegalRule, LegalSection, LegalAssessment

router = APIRouter(prefix="/api/v1/tab2/upload", tags=["Tab 2 Bulk Upload"])

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
PROCESS_COUNT = 5

# (header, mandatory, note)
QUESTION_COLUMNS = [
    ("Chapter Title", True, "Chapter / Part title. Rows with the same title go into the same chapter."),
    ("Rule No.", True, "Whole number, e.g. 5. Same Chapter Title + Rule No. = same rule."),
    ("Rule Narrative", True, "Full rule text. Repeat it on every row of the same rule."),
    ("Section Title", True, "Section title / number. Same rule + Section Title = same section."),
    ("Section Explanation", True, "Repeat it on every row of the same section."),
    ("Practical Examples", False, "Optional."),
    ("Question", True, "Assessment question. One row per question."),
    ("SOP Name", True, "SOP name for this question."),
    ("SOP Details", False, "Optional SOP details & guidelines."),
] + [(f"Process {i} Action", False, f"Optional process {i} narrative.") for i in range(1, PROCESS_COUNT + 1)]

SUBSECTION_COLUMNS = [
    ("Chapter Title", True, "Must match a chapter in the Questions sheet or already in Tab 2."),
    ("Rule No.", True, "Rule number of that chapter."),
    ("Section Title", True, "Must match a section in the Questions sheet or already in Tab 2."),
    ("Sub-section Title", True, "Sub-section heading."),
    ("Paragraph", False, "Optional paragraph under the sub-section. One row per paragraph / sub-paragraph."),
    ("Sub-paragraph", False, "Optional sub-paragraph under the paragraph on the same row."),
]

MANDATORY_FILL = PatternFill("solid", fgColor="FF5A36")
OPTIONAL_FILL = PatternFill("solid", fgColor="D9D9D9")
ERROR_FILL = PatternFill("solid", fgColor="F8B4B4")


def norm(s) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip()


def key(s) -> str:
    return re.sub(r"[^a-z0-9]+", " ", norm(s).lower()).strip()


def master_acts(db: Session) -> set:
    return {
        n for (n,) in db.query(MasterRegistryItem.item_name)
        .join(MasterRegistry, MasterRegistry.id == MasterRegistryItem.registry_id)
        .filter(MasterRegistry.registry_key == "acts").all()
    }


def write_header(ws, columns):
    for c, (title, mandatory, note) in enumerate(columns, start=1):
        cell = ws.cell(row=1, column=c, value=f"{title} *" if mandatory else title)
        cell.font = Font(bold=True, color="FFFFFF" if mandatory else "333333")
        cell.fill = MANDATORY_FILL if mandatory else OPTIONAL_FILL
        cell.alignment = Alignment(wrap_text=True, vertical="center")
        cell.comment = Comment(("Mandatory. " if mandatory else "") + note, "Mood9")
        ws.column_dimensions[cell.column_letter].width = 34 if c > 2 else 22
    ws.freeze_panes = "A2"


@router.get("/template")
def download_template(current_admin: SuperAdmin = Depends(get_current_super_admin)):
    wb = Workbook()
    info = wb.active
    info.title = "Instructions"
    lines = [
        "Mood9 - Tab 2 rules upload template",
        "",
        "1. Fill the 'Questions' sheet: one row per assessment question.",
        "   Repeat Chapter Title, Rule No., Rule Narrative, Section Title and Section Explanation on every row that belongs to them.",
        "2. Optional: fill the 'Sub-sections' sheet: one row per paragraph / sub-paragraph.",
        "3. Orange headers with * are mandatory. Grey headers are optional.",
        "4. In Tab 2 click Upload Excel, choose the Act and the file, then Check File.",
        "   Nothing is saved until the file has no problems and you click Confirm & Save.",
        "5. Chapters, rules, sections and questions that already exist are kept as they are and skipped.",
        "   You can upload in parts (e.g. rules 1-60 now, 61-100 later) or re-upload the same file safely.",
        "6. Organization Type, Departments, Process, Sample Policies and Tasks are set afterwards in Tab 2.",
        "   Questions without an Organization Type are not shown to any account until one is ticked.",
    ]
    for i, line in enumerate(lines, start=1):
        info.cell(row=i, column=1, value=line).font = Font(bold=(i == 1), size=13 if i == 1 else 11)
    info.column_dimensions["A"].width = 120

    write_header(wb.create_sheet("Questions"), QUESTION_COLUMNS)
    write_header(wb.create_sheet("Sub-sections"), SUBSECTION_COLUMNS)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type=XLSX,
                             headers={"Content-Disposition": 'attachment; filename="Mood9_Rules_Upload_Template.xlsx"'})


def read_sheet(wb, name, columns, errors):
    """Returns [(excel_row_number, {header: value})], matching headers by name (ignoring '*')."""
    if name not in wb.sheetnames:
        errors.append({"sheet": name, "row": "-", "column": "-", "problem": f"Sheet '{name}' is missing. Use the downloaded template."})
        return []
    ws = wb[name]
    header_cells = [norm(c.value).rstrip("*").strip() for c in ws[1]]
    index = {}
    for title, mandatory, _ in columns:
        if title in header_cells:
            index[title] = header_cells.index(title)
        elif mandatory:
            errors.append({"sheet": name, "row": 1, "column": title, "problem": "Column is missing. Use the downloaded template."})
    rows = []
    for r_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        values = {title: (norm(row[i]) if i < len(row) else "") for title, i in index.items()}
        if any(values.values()):
            rows.append((r_idx, values))
    return rows


def analyse(db: Session, act_code: str, data: bytes) -> dict:
    """Validates the file and works out what would be added. Never writes."""
    errors = []
    if act_code not in master_acts(db):
        errors.append({"sheet": "-", "row": "-", "column": "Act", "problem": f"Act '{act_code}' is not in the Acts master list."})
    try:
        wb = load_workbook(io.BytesIO(data), data_only=True)
    except Exception:
        return {"errors": [{"sheet": "-", "row": "-", "column": "-", "problem": "This is not a valid .xlsx Excel file."}]}

    q_rows = read_sheet(wb, "Questions", QUESTION_COLUMNS, errors)
    s_rows = read_sheet(wb, "Sub-sections", SUBSECTION_COLUMNS, errors)
    if not q_rows and not s_rows and not errors:
        errors.append({"sheet": "Questions", "row": "-", "column": "-", "problem": "The file has no data rows."})

    def err(sheet, row, column, problem):
        errors.append({"sheet": sheet, "row": row, "column": column, "problem": problem})

    # Existing data for this Act.
    chapters = {key(c.title): c for c in db.query(LegalChapter).filter(LegalChapter.act_code == act_code).all()}

    plan_chapters = {}   # chapter key -> {"title", "rules": {rule_no: {...}}}
    seen_questions = {}  # (chap, rule, sec, question) -> row
    for row, v in q_rows:
        for title, mandatory, _ in QUESTION_COLUMNS:
            if mandatory and not v.get(title):
                err("Questions", row, title, "Mandatory - empty")
        rule_no_raw = v.get("Rule No.", "")
        try:
            rule_no = int(float(rule_no_raw))
            if rule_no < 1 or float(rule_no_raw) != rule_no:
                raise ValueError
        except ValueError:
            if rule_no_raw:
                err("Questions", row, "Rule No.", f"Must be a whole number ('{rule_no_raw}' found)")
            continue
        if not all(v.get(t) for t, m, _ in QUESTION_COLUMNS if m):
            continue

        ck = key(v["Chapter Title"])
        chap = plan_chapters.setdefault(ck, {"title": v["Chapter Title"], "rules": {}})
        rule = chap["rules"].setdefault(rule_no, {"narrative": v["Rule Narrative"], "row": row, "sections": {}})
        if key(rule["narrative"]) != key(v["Rule Narrative"]):
            err("Questions", row, "Rule Narrative", f"Differs from row {rule['row']} for the same Chapter + Rule No. {rule_no}")
        sk = key(v["Section Title"])
        sec = rule["sections"].setdefault(sk, {"title": v["Section Title"], "explanation": v["Section Explanation"],
                                                "examples": v.get("Practical Examples", ""), "row": row,
                                                "questions": [], "subs": []})
        if key(sec["explanation"]) != key(v["Section Explanation"]):
            err("Questions", row, "Section Explanation", f"Differs from row {sec['row']} for the same section")
        qk = (ck, rule_no, sk, key(v["Question"]))
        if qk in seen_questions:
            err("Questions", row, "Question", f"Same question appears twice in this section (also row {seen_questions[qk]})")
            continue
        seen_questions[qk] = row
        sec["questions"].append({
            "question": v["Question"], "sop_name": v["SOP Name"], "sop_details": v.get("SOP Details", ""),
            "processes": [v[f"Process {i} Action"] for i in range(1, PROCESS_COUNT + 1) if v.get(f"Process {i} Action")],
        })

    def find_existing_section(ck, rule_no, sk):
        c = chapters.get(ck)
        if not c:
            return None
        r = next((r for r in c.rules if r.rule_order == rule_no), None)
        return next((s for s in r.sections if key(s.section_title) == sk), None) if r else None

    for row, v in s_rows:
        for title, mandatory, _ in SUBSECTION_COLUMNS:
            if mandatory and not v.get(title):
                err("Sub-sections", row, title, "Mandatory - empty")
        if v.get("Sub-paragraph") and not v.get("Paragraph"):
            err("Sub-sections", row, "Paragraph", "A sub-paragraph needs its paragraph on the same row")
        try:
            rule_no = int(float(v.get("Rule No.", "")))
        except ValueError:
            if v.get("Rule No."):
                err("Sub-sections", row, "Rule No.", f"Must be a whole number ('{v['Rule No.']}' found)")
            continue
        if not all(v.get(t) for t, m, _ in SUBSECTION_COLUMNS if m):
            continue
        ck, sk = key(v["Chapter Title"]), key(v["Section Title"])
        planned = plan_chapters.get(ck, {}).get("rules", {}).get(rule_no, {}).get("sections", {}).get(sk)
        if planned is None and find_existing_section(ck, rule_no, sk) is None:
            err("Sub-sections", row, "Section Title", "No matching section (Chapter + Rule No. + Section Title) in the Questions sheet or Tab 2")
            continue
        entry = (row, v["Sub-section Title"], v.get("Paragraph", ""), v.get("Sub-paragraph", ""))
        if planned is not None:
            planned["subs"].append(entry)
        else:
            # Sub-sections for a section that only exists in Tab 2.
            existing = plan_chapters.setdefault(ck, {"title": v["Chapter Title"], "rules": {}})
            r = existing["rules"].setdefault(rule_no, {"narrative": None, "row": row, "sections": {}})
            r["sections"].setdefault(sk, {"title": v["Section Title"], "explanation": None, "examples": "",
                                          "row": row, "questions": [], "subs": []})["subs"].append(entry)

    # Work out new vs existing.
    summary = {"new_chapters": 0, "new_rules": 0, "new_sections": 0, "new_questions": 0, "new_processes": 0,
               "new_sub_rows": 0, "skipped_rules": 0, "skipped_sections": 0, "skipped_questions": 0}
    skipped = []
    for ck, chap in plan_chapters.items():
        c = chapters.get(ck)
        if not c:
            summary["new_chapters"] += 1
        for rule_no, rule in chap["rules"].items():
            r = next((x for x in c.rules if x.rule_order == rule_no), None) if c else None
            if r:
                summary["skipped_rules"] += 1
            elif rule["narrative"] is None:
                continue
            else:
                summary["new_rules"] += 1
            for sk, sec in rule["sections"].items():
                s = next((x for x in r.sections if key(x.section_title) == sk), None) if r else None
                if s:
                    summary["skipped_sections"] += 1
                elif sec["explanation"] is not None:
                    summary["new_sections"] += 1
                existing_q = {key(a.question) for a in s.assessments} if s else set()
                for q in sec["questions"]:
                    if key(q["question"]) in existing_q:
                        summary["skipped_questions"] += 1
                        skipped.append(f"{chap['title']} | Rule {rule_no} | {q['question'][:90]}")
                    else:
                        summary["new_questions"] += 1
                        summary["new_processes"] += len(q["processes"])
                summary["new_sub_rows"] += len(sec["subs"])

    return {"errors": errors, "summary": summary, "skipped": skipped[:300],
            "plan": plan_chapters, "chapters": chapters}


def public(result: dict) -> dict:
    return {k: result[k] for k in ("errors", "summary", "skipped") if k in result}


@router.post("/check")
async def check_upload(act_code: str = Form(...), file: UploadFile = File(...), db: Session = Depends(get_db),
                       current_admin: SuperAdmin = Depends(get_current_super_admin)):
    return public(analyse(db, act_code, await file.read()))


@router.post("/error-report")
async def error_report(act_code: str = Form(...), file: UploadFile = File(...), db: Session = Depends(get_db),
                       current_admin: SuperAdmin = Depends(get_current_super_admin)):
    data = await file.read()
    result = analyse(db, act_code, data)
    try:
        wb = load_workbook(io.BytesIO(data))
    except Exception:
        raise HTTPException(status_code=400, detail="This is not a valid .xlsx Excel file.")
    by_sheet = {}
    for e in result["errors"]:
        if isinstance(e["row"], int) and e["sheet"] in wb.sheetnames:
            by_sheet.setdefault(e["sheet"], {}).setdefault(e["row"], []).append(e)
    for sheet, rows in by_sheet.items():
        ws = wb[sheet]
        headers = [norm(c.value).rstrip("*").strip() for c in ws[1]]
        err_col = ws.max_column + 1
        head = ws.cell(row=1, column=err_col, value="Errors")
        head.font = Font(bold=True, color="FFFFFF")
        head.fill = PatternFill("solid", fgColor="C0392B")
        ws.column_dimensions[head.column_letter].width = 60
        for row, errs in rows.items():
            for e in errs:
                if e["column"] in headers:
                    ws.cell(row=row, column=headers.index(e["column"]) + 1).fill = ERROR_FILL
            ws.cell(row=row, column=err_col, value="; ".join(f"{e['column']}: {e['problem']}" for e in errs)).fill = ERROR_FILL
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type=XLSX,
                             headers={"Content-Disposition": 'attachment; filename="Upload_Errors.xlsx"'})


def merge_sub(subs: list, title: str, paragraph: str, sub_paragraph: str):
    sub = next((s for s in subs if key(s.get("title")) == key(title)), None)
    if not sub:
        sub = {"title": title, "paragraphs": []}
        subs.append(sub)
    if not paragraph:
        return
    sub.setdefault("paragraphs", [])
    para = next((p for p in sub["paragraphs"] if key(p.get("text")) == key(paragraph)), None)
    if not para:
        para = {"text": paragraph, "sub_paragraphs": []}
        sub["paragraphs"].append(para)
    if sub_paragraph and key(sub_paragraph) not in {key(x) for x in para.setdefault("sub_paragraphs", [])}:
        para["sub_paragraphs"].append(sub_paragraph)


@router.post("/save")
async def save_upload(act_code: str = Form(...), file: UploadFile = File(...), db: Session = Depends(get_db),
                      current_admin: SuperAdmin = Depends(get_current_super_admin)):
    result = analyse(db, act_code, await file.read())
    if result["errors"]:
        raise HTTPException(status_code=400, detail=f"{len(result['errors'])} problem(s) found - nothing was saved. Run Check File first.")
    chapters = result["chapters"]
    try:
        for ck, chap in result["plan"].items():
            c = chapters.get(ck)
            if not c:
                c = LegalChapter(act_code=act_code, title=chap["title"])
                db.add(c)
                db.flush()
            for rule_no in sorted(chap["rules"]):
                rule = chap["rules"][rule_no]
                r = next((x for x in c.rules if x.rule_order == rule_no), None)
                if not r:
                    r = LegalRule(chapter_id=c.id, rule_order=rule_no, rule_narrative=rule["narrative"],
                                  sample_policies="[]", is_hidden=False)
                    db.add(r)
                    db.flush()
                    db.refresh(c)
                for sk, sec in rule["sections"].items():
                    s = next((x for x in r.sections if key(x.section_title) == sk), None)
                    if not s:
                        s = LegalSection(rule_id=r.id, section_title=sec["title"], section_explanation=sec["explanation"],
                                         practical_examples=sec["examples"], mapped_acts=json.dumps([act_code]),
                                         sub_sections="[]")
                        db.add(s)
                        db.flush()
                        db.refresh(r)
                    if sec["subs"]:
                        subs = json.loads(s.sub_sections or "[]")
                        for _, title, paragraph, sub_paragraph in sec["subs"]:
                            merge_sub(subs, title, paragraph, sub_paragraph)
                        s.sub_sections = json.dumps(subs)
                    existing_q = {key(a.question) for a in s.assessments}
                    for q in sec["questions"]:
                        if key(q["question"]) in existing_q:
                            continue
                        db.add(LegalAssessment(
                            section_id=s.id, question=q["question"], mapped_acts=json.dumps([act_code]),
                            industries="[]", industry_process="", mapped_org_types="[]",
                            sop_name=q["sop_name"], sop_details=q["sop_details"] or "",
                            processes=json.dumps([{"action": p, "task_name": "None", "schedule": "None", "auto_tracking": False}
                                                  for p in q["processes"]]),
                        ))
                        existing_q.add(key(q["question"]))
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"status": "saved", "summary": result["summary"]}
