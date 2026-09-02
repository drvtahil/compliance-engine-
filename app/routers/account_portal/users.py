import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.deps import get_current_account_admin_manager
from app.core.security import hash_password
from app.database.connection import get_db
from app.models.tab1_models import AccountAdmin, Role
from app.models.tab2_models import LegalAssessment, QuestionAssignment

router = APIRouter(prefix="/api/v1/account/users", tags=["Account Portal Users"])


class UserPayload(BaseModel):
    name: str
    job_title: str
    role_description: Optional[str] = ""
    phone: str
    email: EmailStr
    password: str = ""


def get_user_allocations(db: Session, user_id: int) -> dict:
    """Industries and Process Areas are not set on a user's profile directly —
    they are derived from whichever questions have been assigned to this user
    via the Allocate Role & Questions matrix."""
    assessments = (
        db.query(LegalAssessment)
        .join(QuestionAssignment, QuestionAssignment.assessment_id == LegalAssessment.id)
        .filter(QuestionAssignment.assigned_user_id == user_id)
        .all()
    )
    industries = set()
    process_areas = set()
    for a in assessments:
        for ind in json.loads(a.industries or "[]"):
            industries.add(ind)
        if a.industry_process:
            process_areas.add(a.industry_process)
    return {"industries": sorted(industries), "process_areas": sorted(process_areas)}


def serialize_user(db: Session, u: AccountAdmin) -> dict:
    allocations = get_user_allocations(db, u.id)
    return {
        "id": u.id,
        "user_code": u.admin_code,
        "name": u.name,
        "job_title": u.job_title or "",
        "role_description": u.role_description or "",
        "phone": u.phone,
        "email": u.email,
        "industries": allocations["industries"],
        "process_areas": allocations["process_areas"],
        "is_active": u.is_active,
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
    }


def next_user_code(db: Session, account_id: int) -> str:
    user_role_id = db.query(Role.id).filter(Role.role_name == "User").scalar()
    count = db.query(AccountAdmin).filter(
        AccountAdmin.account_id == account_id,
        AccountAdmin.role_id == user_role_id,
    ).count()
    return f"USR-{count + 1:04d}"


def assert_email_available(db: Session, email: str, exclude_id: Optional[int] = None):
    query = db.query(AccountAdmin).filter(AccountAdmin.email == email)
    if exclude_id:
        query = query.filter(AccountAdmin.id != exclude_id)
    if query.first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This email is already in use by another user or admin.")


@router.get("")
def list_users(
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin_manager),
):
    user_role_id = db.query(Role.id).filter(Role.role_name == "User").scalar()
    users = db.query(AccountAdmin).filter(
        AccountAdmin.account_id == current_admin.account_id,
        AccountAdmin.role_id == user_role_id,
    ).order_by(AccountAdmin.id.asc()).all()
    return [serialize_user(db, u) for u in users]


@router.post("")
def create_user(
    payload: UserPayload,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin_manager),
):
    if not payload.name.strip() or len(payload.name.strip()) < 2:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Full Name must be at least 2 characters.")
    if not payload.password.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A password is required to create a user.")
    assert_email_available(db, payload.email.strip().lower())

    user_role_id = db.query(Role.id).filter(Role.role_name == "User").scalar()
    user = AccountAdmin(
        account_id=current_admin.account_id,
        admin_code=next_user_code(db, current_admin.account_id),
        name=payload.name.strip(),
        phone=payload.phone.strip(),
        email=payload.email.strip().lower(),
        password=hash_password(payload.password.strip()),
        role_id=user_role_id,
        is_active=True,
        created_by=current_admin.id,
        job_title=payload.job_title.strip(),
        role_description=(payload.role_description or "").strip(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return serialize_user(db, user)


@router.put("/{user_id}")
def update_user(
    user_id: int,
    payload: UserPayload,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin_manager),
):
    user = db.query(AccountAdmin).filter(
        AccountAdmin.id == user_id,
        AccountAdmin.account_id == current_admin.account_id,
    ).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    if not payload.name.strip() or len(payload.name.strip()) < 2:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Full Name must be at least 2 characters.")
    assert_email_available(db, payload.email.strip().lower(), exclude_id=user.id)

    user.name = payload.name.strip()
    user.phone = payload.phone.strip()
    user.email = payload.email.strip().lower()
    user.job_title = payload.job_title.strip()
    user.role_description = (payload.role_description or "").strip()
    if payload.password.strip():
        user.password = hash_password(payload.password.strip())

    db.commit()
    db.refresh(user)
    return serialize_user(db, user)


@router.patch("/{user_id}/toggle-active")
def toggle_active(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin_manager),
):
    user = db.query(AccountAdmin).filter(
        AccountAdmin.id == user_id,
        AccountAdmin.account_id == current_admin.account_id,
    ).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    user.is_active = not user.is_active
    db.commit()
    return {"id": user.id, "is_active": user.is_active}


class ResetPasswordPayload(BaseModel):
    new_password: str


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: int,
    payload: ResetPasswordPayload,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin_manager),
):
    user = db.query(AccountAdmin).filter(
        AccountAdmin.id == user_id,
        AccountAdmin.account_id == current_admin.account_id,
    ).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    if len(payload.new_password.strip()) < 6:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password must be at least 6 characters.")
    user.password = hash_password(payload.new_password.strip())
    db.commit()
    return {"status": "password_reset"}
