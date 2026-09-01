from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Any
from pydantic import BaseModel
import json

from app.core.deps import get_current_super_admin
from app.database.connection import get_db
from app.models.super_admin import SuperAdmin
from app.models.tab1_models import MasterRegistry, MasterRegistryItem
from app.models.tab2_models import LegalChapter, LegalRule, LegalSection, LegalAssessment

router = APIRouter(prefix="/api/v1/tab2", tags=["Tab 2 Deep Rules Engine"])


def validate_sample_policies(db: Session, sample_policies: List[str]):
    if not sample_policies:
        return
    valid_names = {
        name for (name,) in db.query(MasterRegistryItem.item_name)
        .join(MasterRegistry, MasterRegistry.id == MasterRegistryItem.registry_id)
        .filter(MasterRegistry.registry_key == "sample_policies")
        .all()
    }
    invalid = sorted(set(sample_policies) - valid_names)
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"These Sample Policies no longer exist in the Master Registry: {', '.join(invalid)}"
        )

# --- Pydantic Request Schemas ---
class ProcessItem(BaseModel):
    action: str
    task_name: Optional[str] = "None"
    schedule: Optional[str] = "None"
    auto_tracking: Optional[bool] = False

class AssessmentItem(BaseModel):
    id: Optional[int] = None
    question: str
    mapped_acts: List[str] = []
    industries: List[str] = []
    industry_process: Optional[str] = ""
    sop_name: str
    sop_details: str
    processes: List[ProcessItem] = []

class SectionPayload(BaseModel):
    id: Optional[int] = None
    section_title: str
    section_explanation: str
    practical_examples: Optional[str] = ""
    mapped_acts: List[str] = []
    sub_sections: List[Any] = []
    assessments: List[AssessmentItem] = []

class RulePayload(BaseModel):
    id: Optional[int] = None
    rule_order: int = 1
    rule_narrative: str
    sample_policies: List[str] = []
    is_hidden: bool = False
    sections: List[SectionPayload] = []

class ChapterPayload(BaseModel):
    id: Optional[int] = None
    act_code: str
    title: str
    rules: List[RulePayload] = []

class SingleRuleUpdatePayload(BaseModel):
    chapter_id: int
    rule: RulePayload

class AddRuleToChapterPayload(BaseModel):
    chapter_id: int
    rule: RulePayload


# --- GET Chapters By Act Code ---
@router.get("/chapters")
def get_chapters_by_act(act_code: str, db: Session = Depends(get_db)):
    chapters = db.query(LegalChapter).filter(LegalChapter.act_code == act_code).order_by(LegalChapter.id.asc()).all()
    
    result = []
    for chap in chapters:
        rules_data = []
        for r in chap.rules:
            sections_data = []
            for s in r.sections:
                ass_data = []
                for a in s.assessments:
                    ass_data.append({
                        "id": a.id,
                        "question": a.question,
                        "mapped_acts": json.loads(a.mapped_acts or "[]"),
                        "industries": json.loads(a.industries or "[]"),
                        "industry_process": a.industry_process or "",
                        "sop_name": a.sop_name,
                        "sop_details": a.sop_details,
                        "processes": json.loads(a.processes or "[]")
                    })
                sections_data.append({
                    "id": s.id,
                    "section_title": s.section_title,
                    "section_explanation": s.section_explanation,
                    "practical_examples": s.practical_examples or "",
                    "mapped_acts": json.loads(s.mapped_acts or "[]"),
                    "sub_sections": json.loads(s.sub_sections or "[]"),
                    "assessments": ass_data
                })
            rules_data.append({
                "id": r.id,
                "rule_order": r.rule_order,
                "rule_narrative": r.rule_narrative,
                "sample_policies": json.loads(r.sample_policies or "[]"),
                "is_hidden": r.is_hidden,
                "sections": sections_data
            })
        result.append({
            "id": chap.id,
            "act_code": chap.act_code,
            "title": chap.title,
            "rules": rules_data
        })
    return result


# --- Internal Helper to Persist Section & Assessment Levels ---
def sync_section_data(db: Session, rule_id: int, s_item: SectionPayload):
    if not s_item.section_title.strip() and not s_item.section_explanation.strip():
        return

    sec = None
    if s_item.id:
        sec = db.query(LegalSection).filter(LegalSection.id == s_item.id, LegalSection.rule_id == rule_id).first()

    if not sec:
        sec = LegalSection(rule_id=rule_id)
        db.add(sec)

    sec.section_title = s_item.section_title.strip()
    sec.section_explanation = s_item.section_explanation.strip()
    sec.practical_examples = s_item.practical_examples.strip() if s_item.practical_examples else ""
    sec.mapped_acts = json.dumps(s_item.mapped_acts)
    sec.sub_sections = json.dumps(s_item.sub_sections)
    db.commit()
    db.refresh(sec)

    # Sync assessments without deleting other sections
    existing_ass_ids = [a.id for a in s_item.assessments if a.id]
    if existing_ass_ids:
        db.query(LegalAssessment).filter(
            LegalAssessment.section_id == sec.id,
            ~LegalAssessment.id.in_(existing_ass_ids)
        ).delete(synchronize_session=False)
    else:
        db.query(LegalAssessment).filter(LegalAssessment.section_id == sec.id).delete(synchronize_session=False)
    db.commit()

    for a_item in s_item.assessments:
        if not a_item.question.strip() and not a_item.sop_name.strip():
            continue

        valid_processes = [
            p.dict() for p in a_item.processes 
            if p.action.strip() or (p.task_name and p.task_name != "None")
        ]

        ass = None
        if a_item.id:
            ass = db.query(LegalAssessment).filter(LegalAssessment.id == a_item.id, LegalAssessment.section_id == sec.id).first()
        if not ass:
            ass = LegalAssessment(section_id=sec.id)
            db.add(ass)

        ass.question = a_item.question.strip()
        ass.mapped_acts = json.dumps(a_item.mapped_acts)
        ass.industries = json.dumps(a_item.industries)
        ass.industry_process = a_item.industry_process.strip() if a_item.industry_process else ""
        ass.sop_name = a_item.sop_name.strip()
        ass.sop_details = a_item.sop_details.strip()
        ass.processes = json.dumps(valid_processes)
        db.commit()


# --- 1. SAVE NEW OR UPDATE CHAPTER HIERARCHY ---
@router.post("/chapters")
def save_or_update_chapter(payload: ChapterPayload, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="Chapter title cannot be empty.")

    chap = None
    if payload.id:
        chap = db.query(LegalChapter).filter(LegalChapter.id == payload.id).first()
    
    if not chap:
        chap = db.query(LegalChapter).filter(LegalChapter.act_code == payload.act_code, LegalChapter.title == payload.title.strip()).first()

    for r_item in payload.rules:
        if r_item.rule_narrative.strip():
            validate_sample_policies(db, r_item.sample_policies)

    if not chap:
        chap = LegalChapter(act_code=payload.act_code, title=payload.title.strip())
        db.add(chap)
        db.commit()
        db.refresh(chap)
    else:
        chap.title = payload.title.strip()
        db.commit()

    for r_idx, r_item in enumerate(payload.rules):
        if not r_item.rule_narrative.strip():
            continue

        rule = None
        if r_item.id:
            rule = db.query(LegalRule).filter(LegalRule.id == r_item.id, LegalRule.chapter_id == chap.id).first()
        
        if not rule:
            rule = LegalRule(
                chapter_id=chap.id,
                rule_order=r_item.rule_order or (r_idx + 1),
                rule_narrative=r_item.rule_narrative.strip(),
                sample_policies=json.dumps(r_item.sample_policies),
                is_hidden=r_item.is_hidden
            )
            db.add(rule)
            db.commit()
            db.refresh(rule)
        else:
            rule.rule_narrative = r_item.rule_narrative.strip()
            rule.sample_policies = json.dumps(r_item.sample_policies)
            rule.is_hidden = r_item.is_hidden
            rule.rule_order = r_item.rule_order or (r_idx + 1)
            db.commit()

        for s_item in r_item.sections:
            sync_section_data(db, rule.id, s_item)

    return {"status": "saved", "chapter_id": chap.id}


# --- 2. UPDATE SINGLE RULE NODE (Preserves Other Rules in Chapter) ---
@router.put("/rules/{rule_id}")
def update_single_rule(rule_id: int, payload: SingleRuleUpdatePayload, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    rule = db.query(LegalRule).filter(LegalRule.id == rule_id, LegalRule.chapter_id == payload.chapter_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found in this chapter.")

    r_item = payload.rule
    validate_sample_policies(db, r_item.sample_policies)
    rule.rule_narrative = r_item.rule_narrative.strip()
    rule.sample_policies = json.dumps(r_item.sample_policies)
    rule.is_hidden = r_item.is_hidden
    if r_item.rule_order:
        rule.rule_order = r_item.rule_order
    db.commit()

    for s_item in r_item.sections:
        sync_section_data(db, rule.id, s_item)

    return {"status": "updated", "rule_id": rule.id}


# --- 3. ADD NEW RULE DIRECTLY TO EXISTING CHAPTER ---
@router.post("/chapters/{chapter_id}/rules")
def add_rule_to_existing_chapter(chapter_id: int, payload: AddRuleToChapterPayload, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    chap = db.query(LegalChapter).filter(LegalChapter.id == chapter_id).first()
    if not chap:
        raise HTTPException(status_code=404, detail="Chapter not found.")

    r_item = payload.rule
    validate_sample_policies(db, r_item.sample_policies)
    max_order = db.query(LegalRule).filter(LegalRule.chapter_id == chapter_id).count()
    new_rule = LegalRule(
        chapter_id=chap.id,
        rule_order=max_order + 1,
        rule_narrative=r_item.rule_narrative.strip(),
        sample_policies=json.dumps(r_item.sample_policies),
        is_hidden=r_item.is_hidden
    )
    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)

    for s_item in r_item.sections:
        sync_section_data(db, new_rule.id, s_item)

    return {"status": "created", "rule_id": new_rule.id}


# --- 4. TOGGLE HIDE / UNHIDE RULE ---
@router.patch("/rules/{rule_id}/toggle-hide")
def toggle_rule_hide(rule_id: int, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    rule = db.query(LegalRule).filter(LegalRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    rule.is_hidden = not rule.is_hidden
    db.commit()
    db.refresh(rule)
    return {"status": "updated", "id": rule.id, "is_hidden": rule.is_hidden}