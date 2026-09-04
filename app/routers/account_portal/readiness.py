import json
from datetime import datetime
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_current_account_admin, get_current_account_admin_manager
from app.database.connection import get_db
from app.models.tab1_models import AccountAdmin, AccountEnrolledAct
from app.models.tab2_models import LegalAssessment, LegalSection, LegalRule, LegalChapter, QuestionAssignment, ReadinessSubmission

router = APIRouter(prefix="/api/v1/account/readiness", tags=["Account Portal Readiness"])


def assert_act_enrolled(db: Session, account_id: int, act_code: str):
    enrolled = {a for (a,) in db.query(AccountEnrolledAct.act_name).filter(AccountEnrolledAct.account_id == account_id).all()}
    if act_code not in enrolled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This Act is not enrolled for your account.")


def is_locked(db: Session, account_id: int, act_code: str) -> bool:
    return db.query(ReadinessSubmission).filter(
        ReadinessSubmission.account_id == account_id,
        ReadinessSubmission.act_code == act_code,
    ).first() is not None


def assignments_query_for_act(db: Session, account_id: int, act_code: str):
    return (
        db.query(QuestionAssignment)
        .join(LegalAssessment, QuestionAssignment.assessment_id == LegalAssessment.id)
        .join(LegalSection, LegalAssessment.section_id == LegalSection.id)
        .join(LegalRule, LegalSection.rule_id == LegalRule.id)
        .join(LegalChapter, LegalRule.chapter_id == LegalChapter.id)
        .filter(QuestionAssignment.account_id == account_id, LegalChapter.act_code == act_code)
    )


def serialize_row(qa: QuestionAssignment, include_assignee: bool) -> dict:
    a = qa.assessment
    row = {
        "assessment_id": a.id,
        "assignment_id": qa.id,
        "question": a.question,
        "industries": json.loads(a.industries or "[]"),
        "industry_process": a.industry_process or "",
        "chapter_title": a.section.rule.chapter.title,
        "rule_order": a.section.rule.rule_order,
        "response": qa.response,
    }
    if include_assignee:
        row["assigned_user"] = {
            "id": qa.assigned_user.id,
            "name": qa.assigned_user.name,
            "user_code": qa.assigned_user.admin_code,
        }
    return row


@router.get("")
def get_my_readiness(
    act_code: str,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin),
):
    assert_act_enrolled(db, current_admin.account_id, act_code)
    rows = assignments_query_for_act(db, current_admin.account_id, act_code).filter(
        QuestionAssignment.assigned_user_id == current_admin.id
    ).all()
    return {
        "locked": is_locked(db, current_admin.account_id, act_code),
        "questions": [serialize_row(qa, include_assignee=False) for qa in rows],
    }


@router.get("/all")
def get_all_readiness(
    act_code: str,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin_manager),
):
    assert_act_enrolled(db, current_admin.account_id, act_code)
    rows = assignments_query_for_act(db, current_admin.account_id, act_code).all()
    return {
        "locked": is_locked(db, current_admin.account_id, act_code),
        "questions": [serialize_row(qa, include_assignee=True) for qa in rows],
    }


@router.get("/status")
def get_readiness_status(
    act_code: str,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin),
):
    sub = db.query(ReadinessSubmission).filter(
        ReadinessSubmission.account_id == current_admin.account_id,
        ReadinessSubmission.act_code == act_code,
    ).first()
    if not sub:
        return {"locked": False, "submitted_at": None, "submitted_by": None}
    return {
        "locked": True,
        "submitted_at": sub.submitted_at,
        "submitted_by": sub.submitted_by_admin.name if sub.submitted_by_admin else None,
    }


class ResponsePayload(BaseModel):
    response: Optional[Literal["Yes", "No", "NA"]] = None


@router.patch("/{assessment_id}/response")
def set_response(
    assessment_id: int,
    payload: ResponsePayload,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin),
):
    qa = db.query(QuestionAssignment).filter(
        QuestionAssignment.assessment_id == assessment_id,
        QuestionAssignment.account_id == current_admin.account_id,
    ).first()
    if not qa:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This question is not assigned within your account.")

    is_manager = current_admin.role.role_name == "Account Admin"
    if not is_manager and qa.assigned_user_id != current_admin.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only respond to questions assigned to you.")

    act_code = qa.assessment.section.rule.chapter.act_code
    if is_locked(db, current_admin.account_id, act_code):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This Act's Readiness has been submitted and is locked. Ask your Account Admin to reopen it first."
        )

    qa.response = payload.response
    db.commit()
    return {"status": "updated", "assessment_id": assessment_id, "response": qa.response}


class ActPayload(BaseModel):
    act_code: str


@router.post("/submit")
def submit_readiness(
    payload: ActPayload,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin_manager),
):
    assert_act_enrolled(db, current_admin.account_id, payload.act_code)
    rows = assignments_query_for_act(db, current_admin.account_id, payload.act_code).all()
    if not rows:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No questions are allocated for this Act yet.")
    unanswered = sum(1 for qa in rows if not qa.response)
    if unanswered:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{unanswered} question(s) still need a response before you can submit.")

    existing = db.query(ReadinessSubmission).filter(
        ReadinessSubmission.account_id == current_admin.account_id,
        ReadinessSubmission.act_code == payload.act_code,
    ).first()
    if existing:
        existing.submitted_by = current_admin.id
        existing.submitted_at = datetime.utcnow()
    else:
        db.add(ReadinessSubmission(
            account_id=current_admin.account_id,
            act_code=payload.act_code,
            submitted_by=current_admin.id,
        ))
    db.commit()
    return {"status": "submitted", "act_code": payload.act_code}


@router.post("/unsubmit")
def unsubmit_readiness(
    payload: ActPayload,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin_manager),
):
    db.query(ReadinessSubmission).filter(
        ReadinessSubmission.account_id == current_admin.account_id,
        ReadinessSubmission.act_code == payload.act_code,
    ).delete()
    db.commit()
    return {"status": "reopened", "act_code": payload.act_code}
