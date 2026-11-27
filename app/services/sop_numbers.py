"""Stored SOP numbers: each Act numbers its SOPs 1, 2, 3 ... once; new SOPs take
the next free number and numbers never change (deleted ones leave a gap)."""
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.tab2_models import LegalAssessment, LegalChapter, LegalRule, LegalSection


def next_sop_no(db: Session, act_code: str) -> int:
    current = (
        db.query(func.max(LegalAssessment.sop_no))
        .join(LegalSection, LegalAssessment.section_id == LegalSection.id)
        .join(LegalRule, LegalSection.rule_id == LegalRule.id)
        .join(LegalChapter, LegalRule.chapter_id == LegalChapter.id)
        .filter(LegalChapter.act_code == act_code)
        .scalar()
    )
    return (current or 0) + 1


def sop_ref(assessment) -> str:
    """Display reference, e.g. SOP-007."""
    return f"SOP-{assessment.sop_no:03d}" if assessment.sop_no else f"SOP-{assessment.id}"
