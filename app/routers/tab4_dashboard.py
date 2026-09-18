from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_super_admin
from app.database.connection import get_db
from app.models.super_admin import SuperAdmin
from app.services import training_dashboard as svc

router = APIRouter(prefix="/api/v1/tab4/training/dashboard", tags=["Tab 4 Training - Dashboard"])


@router.get("/summary")
def get_summary(db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    return svc.build_summary(db)


@router.get("/accounts")
def get_accounts_rollup(db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    return svc.build_accounts_rollup(db)


@router.get("/courses")
def get_courses_rollup(db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    return svc.build_courses_rollup(db)


@router.get("/courses/{course_id}/modules")
def get_course_modules_rollup(course_id: int, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    return svc.build_course_modules_rollup(db, course_id)


@router.get("/records")
def get_records(
    act_code: Optional[str] = None,
    course_id: Optional[int] = None,
    module_id: Optional[int] = None,
    account_id: Optional[int] = None,
    role_id: Optional[int] = None,
    department_item_id: Optional[int] = None,
    process_item_id: Optional[int] = None,
    status: Optional[str] = None,
    assigned_from: Optional[date] = None,
    assigned_to: Optional[date] = None,
    completed_from: Optional[date] = None,
    completed_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_admin: SuperAdmin = Depends(get_current_super_admin),
):
    return svc.build_records(
        db, act_code=act_code, course_id=course_id, module_id=module_id,
        filter_account_id=account_id, role_id=role_id,
        department_item_id=department_item_id, process_item_id=process_item_id,
        status_filter=status, assigned_from=assigned_from, assigned_to=assigned_to,
        completed_from=completed_from, completed_to=completed_to,
    )
