from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_account_admin_manager
from app.database.connection import get_db
from app.models.tab1_models import AccountAdmin, MasterRegistry, MasterRegistryItem, Role
from app.services import training_dashboard as svc

router = APIRouter(prefix="/api/v1/account/training/dashboard", tags=["Account Portal Team Dashboard"])
# Account Admin only (get_current_account_admin_manager enforces role_name == "Account Admin"),
# and every query below is forced to their own account_id - there is no way to widen scope
# via query params, unlike the Super Admin's equivalent endpoints.


@router.get("/filters")
def get_filter_options(db: Session = Depends(get_db), current_admin: AccountAdmin = Depends(get_current_account_admin_manager)):
    """Department/Process/Role option lists for the dashboard's filter bar -
    global reference data, not account-scoped (there's nothing to scope)."""
    def items_for(registry_key):
        reg = db.query(MasterRegistry).filter(MasterRegistry.registry_key == registry_key).first()
        if not reg:
            return []
        return [{"id": i.id, "item_name": i.item_name} for i in db.query(MasterRegistryItem).filter(MasterRegistryItem.registry_id == reg.id).order_by(MasterRegistryItem.id.asc()).all()]

    roles = db.query(Role).order_by(Role.id.asc()).all()
    return {
        "departments": items_for("industries"),
        "processes": items_for("industry_processes"),
        "roles": [{"id": r.id, "role_name": r.role_name} for r in roles],
    }


@router.get("/summary")
def get_summary(db: Session = Depends(get_db), current_admin: AccountAdmin = Depends(get_current_account_admin_manager)):
    return svc.build_summary(db, account_id=current_admin.account_id)


@router.get("/courses")
def get_courses_rollup(db: Session = Depends(get_db), current_admin: AccountAdmin = Depends(get_current_account_admin_manager)):
    return svc.build_courses_rollup(db, account_id=current_admin.account_id)


@router.get("/courses/{course_id}/modules")
def get_course_modules_rollup(course_id: int, db: Session = Depends(get_db), current_admin: AccountAdmin = Depends(get_current_account_admin_manager)):
    return svc.build_course_modules_rollup(db, course_id, account_id=current_admin.account_id)


@router.get("/records")
def get_records(
    course_id: Optional[int] = None,
    module_id: Optional[int] = None,
    role_id: Optional[int] = None,
    department_item_id: Optional[int] = None,
    process_item_id: Optional[int] = None,
    status: Optional[str] = None,
    assigned_from: Optional[date] = None,
    assigned_to: Optional[date] = None,
    completed_from: Optional[date] = None,
    completed_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin_manager),
):
    return svc.build_records(
        db, account_id=current_admin.account_id, course_id=course_id, module_id=module_id,
        role_id=role_id, department_item_id=department_item_id, process_item_id=process_item_id,
        status_filter=status, assigned_from=assigned_from, assigned_to=assigned_to,
        completed_from=completed_from, completed_to=completed_to,
    )
