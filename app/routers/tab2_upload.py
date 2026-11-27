"""Tab 2 bulk upload: a text-only Excel template for chapters, rules, sections,
sub-sections / paragraphs / sub-paragraphs, assessment questions, SOPs and
process actions - all on one 'Questions' sheet.

Rows with the same Chapter + Rule No. + Section Title are one section. A row can
add sub-section text, a question (attached to the section), or both. Several
sub-paragraphs can share one cell, one per line.

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
from app.services.sop_numbers import next_sop_no
from app.models.tab2_models import LegalChapter, LegalRule, LegalSection, LegalAssessment

router = APIRouter(prefix="/api/v1/tab2/upload", tags=["Tab 2 Bulk Upload"])

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
PROCESS_COUNT = 5
SHEET = "Questions"

# (header, mandatory, note)
COLUMNS = [
    ("Chapter Title", True, "Chapter / Part title. Rows with the same title go into the same chapter."),
    ("Rule No.", True, "Whole number, e.g. 5. Same Chapter Title + Rule No. = same rule."),
    ("Rule Narrative", True, "Full rule text. Repeat it on every row of the same rule."),
    ("Section Title", True, "Section title / number. Same rule + Section Title = same section."),
    ("Section Explanation", True, "Repeat it on every row of the same section."),
    ("Practical Examples", False, "Optional."),
    ("Sub-section Title", False, "Optional. Rows with the same Sub-section Title (in the same section) build one sub-section."),
    ("Paragraph", False, "Optional paragraph under the sub-section on this row."),
    ("Sub-paragraph", False, "Optional. Several sub-paragraphs can go in one cell, one per line (Alt+Enter)."),
    ("Question", False, "Assessment question for the SECTION (not the sub-section). Type each question once, on any row of the section. Needs SOP Name."),
    ("SOP Name", False, "Required when the row has a Question."),
    ("SOP Details", False, "Optional SOP details & guidelines."),
] + [(f"Process {i} Action", False, f"Optional process {i} narrative for the Question on this row.") for i in range(1, PROCESS_COUNT + 1)]

EXAMPLE_ROWS = [
    ["CHAPTER II OBLIGATIONS OF DATA FIDUCIARY", 5, "Notice", "5(1) Notice before consent",
     "Every consent request must be preceded by a clear, itemized notice.", "A hospital shows a notice at the patient registration kiosk.",
     "(1) Content of notice", "(a) Personal data and purpose", "(i) Itemized list of personal data\n(ii) Specific purpose for each item",
     "Is the notice delivered before or with every consent request?", "SOP-01 Notice Delivery Verification",
     "Check every collection point shows the notice first.", "Map all data collection points", "Review notice placement monthly", "", "", ""],
    ["CHAPTER II OBLIGATIONS OF DATA FIDUCIARY", 5, "Notice", "5(1) Notice before consent",
     "Every consent request must be preceded by a clear, itemized notice.", "",
     "(1) Content of notice", "(b) Rights and complaints", "(i) How to withdraw consent\n(ii) How to complain to the Board",
     "Does the notice include the DPB complaint method?", "SOP-02 Notice Content Review", "", "Audit notice text", "", "", "", ""],
    ["CHAPTER II OBLIGATIONS OF DATA FIDUCIARY", 5, "Notice", "5(1) Notice before consent",
     "Every consent request must be preceded by a clear, itemized notice.", "",
     "(2) Language of notice", "(a) English", "(i) Plain language\n(ii) No legal jargon",
     "", "", "", "", "", "", "", ""],
    ["CHAPTER II OBLIGATIONS OF DATA FIDUCIARY", 5, "Notice", "5(1) Notice before consent",
     "Every consent request must be preceded by a clear, itemized notice.", "",
     "(2) Language of notice", "(b) Eighth Schedule languages", "(i) Offered on request\n(ii) Accurate translation",
     "", "", "", "", "", "", "", ""],
    ["CHAPTER II OBLIGATIONS OF DATA FIDUCIARY", 5, "Notice", "5(2) Legacy consent",
     "Data collected before the Act needs a notice as soon as practicable.", "",
     "", "", "", "Has the organization inventoried legacy consent-based data?", "SOP-03 Legacy Data Inventory", "", "", "", "", "", ""],
]

MANDATORY_FILL = PatternFill("solid", fgColor="FF5A36")
OPTIONAL_FILL = PatternFill("solid", fgColor="D9D9D9")
ERROR_FILL = PatternFill("solid", fgColor="F8B4B4")


def norm(s) -> str:
    return re.sub(r"[ \t]+", " ", str(s or "")).strip()


def key(s) -> str:
    return re.sub(r"[^a-z0-9]+", " ", norm(s).lower()).strip()


def lines(s) -> list:
    return [x.strip() for x in str(s or "").splitlines() if x.strip()]


def master_acts(db: Session) -> set:
    return {
        n for (n,) in db.query(MasterRegistryItem.item_name)
        .join(MasterRegistry, MasterRegistry.id == MasterRegistryItem.registry_id)
        .filter(MasterRegistry.registry_key == "acts").all()
    }


def write_header(ws):
    for c, (title, mandatory, note) in enumerate(COLUMNS, start=1):
        cell = ws.cell(row=1, column=c, value=f"{title} *" if mandatory else title)
        cell.font = Font(bold=True, color="FFFFFF" if mandatory else "333333")
        cell.fill = MANDATORY_FILL if mandatory else OPTIONAL_FILL
        cell.alignment = Alignment(wrap_text=True, vertical="center")
        cell.comment = Comment(("Mandatory. " if mandatory else "") + note, "Mood9")
        ws.column_dimensions[cell.column_letter].width = 14 if title == "Rule No." else 32
    ws.freeze_panes = "A2"


@router.get("/template")
def download_template(current_admin: SuperAdmin = Depends(get_current_super_admin)):
    wb = Workbook()
    info = wb.active
    info.title = "Instructions"
    text = [
        "Mood9 - Tab 2 rules upload template",
        "",
        "Fill the 'Questions' sheet. The 'Example' sheet shows a filled sample - it is never uploaded.",
        "",
        "1. Orange headers with * are mandatory on every row: Chapter Title, Rule No., Rule Narrative, Section Title, Section Explanation.",
        "   Repeat them on every row that belongs to the same rule / section.",
        "2. Rows with the same Chapter Title + Rule No. + Section Title are ONE section.",
        "3. Sub-sections: use one row per paragraph. Rows with the same Sub-section Title build one sub-section.",
        "   Several sub-paragraphs of a paragraph can go in one cell, one per line (Alt+Enter), or on separate rows.",
        "4. Questions belong to the SECTION, not to a sub-section. Type each question once, on any row of its section.",
        "   A row with a Question needs an SOP Name. A section may have no question at all.",
        "5. Process 1-5 Action belong to the Question on the same row.",
        "6. In Tab 2 click Upload Excel, choose the Act and the file, then Check File. Nothing is saved until",
        "   the file has no problems and you click Confirm & Save.",
        "7. Chapters, rules, sections and questions that already exist are kept as they are and skipped,",
        "   so you can upload in parts (e.g. rules 1-60 now, 61-100 later) or re-upload the same file safely.",
        "8. Organization Type, Departments, Process, Sample Policies and Tasks are set afterwards in Tab 2.",
        "   Questions without an Organization Type are not shown to any account until one is ticked.",
    ]
    for i, line in enumerate(text, start=1):
        info.cell(row=i, column=1, value=line).font = Font(bold=(i == 1), size=13 if i == 1 else 11)
    info.column_dimensions["A"].width = 125

    write_header(wb.create_sheet(SHEET))
    example = wb.create_sheet("Example")
    write_header(example)
    for row in EXAMPLE_ROWS:
        example.append(row)
    for row in example.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(wrap_text=True, vertical="top")

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type=XLSX,
                             headers={"Content-Disposition": 'attachment; filename="Mood9_Rules_Upload_Template.xlsx"'})


def read_rows(wb, errors):
    """Returns [(excel_row_number, {header: value})], matching headers by name (ignoring '*')."""
    if SHEET not in wb.sheetnames:
        errors.append({"sheet": SHEET, "row": "-", "column": "-", "problem": f"Sheet '{SHEET}' is missing. Use the downloaded template."})
        return []
    ws = wb[SHEET]
    header_cells = [norm(c.value).rstrip("*").strip() for c in ws[1]]
    index = {}
    for title, mandatory, _ in COLUMNS:
        if title in header_cells:
            index[title] = header_cells.index(title)
        elif mandatory:
            errors.append({"sheet": SHEET, "row": 1, "column": title, "problem": "Column is missing. Use the downloaded template."})
    rows = []
    for r_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        values = {}
        for title, i in index.items():
            raw = row[i] if i < len(row) else None
            values[title] = str(raw).strip() if title == "Sub-paragraph" and raw is not None else norm(raw)
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

    rows = read_rows(wb, errors)
    if not rows and not errors:
        errors.append({"sheet": SHEET, "row": "-", "column": "-", "problem": "The Questions sheet has no data rows."})

    def err(row, column, problem):
        errors.append({"sheet": SHEET, "row": row, "column": column, "problem": problem})

    chapters = {key(c.title): c for c in db.query(LegalChapter).filter(LegalChapter.act_code == act_code).all()}

    plan = {}            # chapter key -> {"title", "rules": {rule_no: {...}}}
    seen_questions = {}  # (chap, rule, sec, question) -> row
    for row, v in rows:
        bad = False
        for title, mandatory, _ in COLUMNS:
            if mandatory and not v.get(title):
                err(row, title, "Mandatory - empty")
                bad = True
        rule_no_raw = v.get("Rule No.", "")
        rule_no = None
        try:
            rule_no = int(float(rule_no_raw))
            if rule_no < 1 or float(rule_no_raw) != rule_no:
                raise ValueError
        except ValueError:
            if rule_no_raw:
                err(row, "Rule No.", f"Must be a whole number ('{rule_no_raw}' found)")
            bad = True
        has_q = bool(v.get("Question"))
        if has_q and not v.get("SOP Name"):
            err(row, "SOP Name", "Required when the row has a Question")
            bad = True
        if not has_q and v.get("SOP Name"):
            err(row, "Question", "SOP Name is filled but the Question is empty")
            bad = True
        if not has_q and (v.get("SOP Details") or any(v.get(f"Process {i} Action") for i in range(1, PROCESS_COUNT + 1))):
            err(row, "Question", "SOP Details / Process actions need a Question on the same row")
            bad = True
        if v.get("Paragraph") and not v.get("Sub-section Title"):
            err(row, "Sub-section Title", "A paragraph needs its Sub-section Title on the same row")
            bad = True
        if v.get("Sub-paragraph") and not v.get("Paragraph"):
            err(row, "Paragraph", "A sub-paragraph needs its Paragraph on the same row")
            bad = True
        if bad:
            continue

        ck = key(v["Chapter Title"])
        chap = plan.setdefault(ck, {"title": v["Chapter Title"], "rules": {}})
        rule = chap["rules"].setdefault(rule_no, {"narrative": v["Rule Narrative"], "row": row, "sections": {}})
        if key(rule["narrative"]) != key(v["Rule Narrative"]):
            err(row, "Rule Narrative", f"Differs from row {rule['row']} for the same Chapter + Rule No. {rule_no}")
        sk = key(v["Section Title"])
        sec = rule["sections"].setdefault(sk, {"title": v["Section Title"], "explanation": v["Section Explanation"],
                                                "examples": v.get("Practical Examples", ""), "row": row,
                                                "questions": [], "subs": []})
        if key(sec["explanation"]) != key(v["Section Explanation"]):
            err(row, "Section Explanation", f"Differs from row {sec['row']} for the same section")
        if v.get("Practical Examples") and not sec["examples"]:
            sec["examples"] = v["Practical Examples"]
        if v.get("Sub-section Title"):
            sec["subs"].append((v["Sub-section Title"], v.get("Paragraph", ""), lines(v.get("Sub-paragraph"))))
        if has_q:
            qk = (ck, rule_no, sk, key(v["Question"]))
            if qk in seen_questions:
                err(row, "Question", f"Same question appears twice in this section (also row {seen_questions[qk]})")
                continue
            seen_questions[qk] = row
            sec["questions"].append({
                "question": v["Question"], "sop_name": v["SOP Name"], "sop_details": v.get("SOP Details", ""),
                "processes": [v[f"Process {i} Action"] for i in range(1, PROCESS_COUNT + 1) if v.get(f"Process {i} Action")],
            })

    # Work out new vs existing.
    summary = {"new_chapters": 0, "new_rules": 0, "new_sections": 0, "new_questions": 0, "new_processes": 0,
               "new_sub_lines": 0, "skipped_rules": 0, "skipped_sections": 0, "skipped_questions": 0}
    skipped = []
    for ck, chap in plan.items():
        c = chapters.get(ck)
        if not c:
            summary["new_chapters"] += 1
        for rule_no, rule in chap["rules"].items():
            r = next((x for x in c.rules if x.rule_order == rule_no), None) if c else None
            summary["skipped_rules" if r else "new_rules"] += 1
            for sk, sec in rule["sections"].items():
                s = next((x for x in r.sections if key(x.section_title) == sk), None) if r else None
                summary["skipped_sections" if s else "new_sections"] += 1
                existing_q = {key(a.question) for a in s.assessments} if s else set()
                for q in sec["questions"]:
                    if key(q["question"]) in existing_q:
                        summary["skipped_questions"] += 1
                        skipped.append(f"{chap['title']} | Rule {rule_no} | {q['question'][:90]}")
                    else:
                        summary["new_questions"] += 1
                        summary["new_processes"] += len(q["processes"])
                summary["new_sub_lines"] += sum(1 + len(subp) for _, _, subp in sec["subs"])

    return {"errors": errors, "summary": summary, "skipped": skipped[:300], "plan": plan, "chapters": chapters}


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
    by_row = {}
    for e in result["errors"]:
        if isinstance(e["row"], int) and e["sheet"] in wb.sheetnames:
            by_row.setdefault((e["sheet"], e["row"]), []).append(e)
    if by_row:
        ws = wb[SHEET]
        headers = [norm(c.value).rstrip("*").strip() for c in ws[1]]
        err_col = ws.max_column + 1
        head = ws.cell(row=1, column=err_col, value="Errors")
        head.font = Font(bold=True, color="FFFFFF")
        head.fill = PatternFill("solid", fgColor="C0392B")
        ws.column_dimensions[head.column_letter].width = 60
        for (_, row), errs in by_row.items():
            for e in errs:
                if e["column"] in headers:
                    ws.cell(row=row, column=headers.index(e["column"]) + 1).fill = ERROR_FILL
            ws.cell(row=row, column=err_col, value="; ".join(f"{e['column']}: {e['problem']}" for e in errs)).fill = ERROR_FILL
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type=XLSX,
                             headers={"Content-Disposition": 'attachment; filename="Upload_Errors.xlsx"'})


def merge_sub(subs: list, title: str, paragraph: str, sub_paragraphs: list):
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
    existing = {key(x) for x in para.setdefault("sub_paragraphs", [])}
    for sp in sub_paragraphs:
        if key(sp) not in existing:
            para["sub_paragraphs"].append(sp)
            existing.add(key(sp))


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
                        for title, paragraph, sub_paragraphs in sec["subs"]:
                            merge_sub(subs, title, paragraph, sub_paragraphs)
                        s.sub_sections = json.dumps(subs)
                    existing_q = {key(a.question) for a in s.assessments}
                    for q in sec["questions"]:
                        if key(q["question"]) in existing_q:
                            continue
                        db.add(LegalAssessment(
                            section_id=s.id, sop_no=next_sop_no(db, act_code), question=q["question"], mapped_acts=json.dumps([act_code]),
                            industries="[]", industry_process="", mapped_org_types="[]",
                            sop_name=q["sop_name"], sop_details=q["sop_details"] or "",
                            processes=json.dumps([{"action": p, "task_name": "None", "schedule": "None", "auto_tracking": False}
                                                  for p in q["processes"]]),
                        ))
                        existing_q.add(key(q["question"]))
                        db.flush()  # so the next question sees this SOP number
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"status": "saved", "summary": result["summary"]}
