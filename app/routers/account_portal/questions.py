from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
import json

from app.core.deps import get_current_account_admin_manager
from app.database.connection import get_db
from app.models.tab1_models import AccountAdmin, AccountEnrolledAct, Role
from app.models.tab2_models import LegalAssessment, LegalSection, LegalRule, LegalChapter, QuestionAssignment

router = APIRouter(prefix="/api/v1/account/questions", tags=["Account Portal Question Allocation"])


def assert_act_enrolled(db: Session, account_id: int, act_code: str):
    enrolled = {a for (a,) in db.query(AccountEnrolledAct.act_name).filter(AccountEnrolledAct.account_id == account_id).all()}
    if act_code not in enrolled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This Act is not enrolled for your account.")


@router.get("")
def list_questions(
    act_code: str,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin_manager),
):
    assert_act_enrolled(db, current_admin.account_id, act_code)

    rows = (
        db.query(LegalAssessment)
        .join(LegalSection, LegalAssessment.section_id == LegalSection.id)
        .join(LegalRule, LegalSection.rule_id == LegalRule.id)
        .join(LegalChapter, LegalRule.chapter_id == LegalChapter.id)
        .filter(LegalChapter.act_code == act_code)
        .all()
    )

    assignments = {
        a.assessment_id: a for a in db.query(QuestionAssignment).filter(QuestionAssignment.account_id == current_admin.account_id).all()
    }

    account_org_type = current_admin.account.org_type
    result = []
    for a in rows:
        if account_org_type not in json.loads(a.mapped_org_types or "[]"):
            continue
        assignment = assignments.get(a.id)
        assigned_user = assignment.assigned_user if assignment else None
        result.append({
            "id": a.id,
            "question": a.question,
            "industries": json.loads(a.industries or "[]"),
            "industry_process": a.industry_process or "",
            "sop_name": a.sop_name,
            "chapter_title": a.section.rule.chapter.title,
            "rule_order": a.section.rule.rule_order,
            "assigned_user": {
                "id": assigned_user.id,
                "name": assigned_user.name,
                "user_code": assigned_user.admin_code,
            } if assigned_user else None,
        })
    return result


@router.get("/assignable-users")
def assignable_users(
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin_manager),
):
    user_role_id = db.query(Role.id).filter(Role.role_name == "User").scalar()
    users = db.query(AccountAdmin).filter(
        AccountAdmin.account_id == current_admin.account_id,
        AccountAdmin.role_id == user_role_id,
        AccountAdmin.is_active == True,
    ).order_by(AccountAdmin.name.asc()).all()
    return [{"id": u.id, "name": u.name, "user_code": u.admin_code} for u in users]


class AssignPayload(BaseModel):
    user_id: int


@router.post("/{assessment_id}/assign")
def assign_question(
    assessment_id: int,
    payload: AssignPayload,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin_manager),
):
    assessment = db.query(LegalAssessment).filter(LegalAssessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found.")

    user_role_id = db.query(Role.id).filter(Role.role_name == "User").scalar()
    user = db.query(AccountAdmin).filter(
        AccountAdmin.id == payload.user_id,
        AccountAdmin.account_id == current_admin.account_id,
        AccountAdmin.role_id == user_role_id,
        AccountAdmin.is_active == True,
    ).first()
    if not user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Active user not found in your account.")

    existing = db.query(QuestionAssignment).filter(
        QuestionAssignment.account_id == current_admin.account_id,
        QuestionAssignment.assessment_id == assessment_id,
    ).first()
    if existing:
        existing.assigned_user_id = user.id
        existing.assigned_by = current_admin.id
    else:
        db.add(QuestionAssignment(
            account_id=current_admin.account_id,
            assessment_id=assessment_id,
            assigned_user_id=user.id,
            assigned_by=current_admin.id,
        ))
    db.commit()
    return {"status": "assigned", "assessment_id": assessment_id, "user_id": user.id}


@router.delete("/{assessment_id}/assign")
def unassign_question(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin_manager),
):
    db.query(QuestionAssignment).filter(
        QuestionAssignment.account_id == current_admin.account_id,
        QuestionAssignment.assessment_id == assessment_id,
    ).delete()
    db.commit()
    return {"status": "unassigned", "assessment_id": assessment_id}
