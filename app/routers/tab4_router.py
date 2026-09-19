import os
import csv
import io
import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.config import settings
from app.core.deps import get_current_super_admin
from app.database.connection import get_db
from app.models.super_admin import SuperAdmin
from app.models.tab1_models import EnterpriseAccount, Role, AccountAdmin, MasterRegistry, MasterRegistryItem, AccountEnrolledAct
from app.models.tab4_models import (
    TrainingCourse, TrainingModule, TrainingContentItem,
    TrainingCourseAllocation, TrainingAuditLog,
)
from app.models.notifications import Notification
from app.services.training_assignments import serialize_assignment_admin

router = APIRouter(prefix="/api/v1/tab4/training", tags=["Tab 4 Training - Course Builder"])

UPLOAD_DIR = Path(settings.upload_dir).resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# --- Audit log helper ---
def log_audit(db: Session, entity_type: str, entity_id: int, action: str, performed_by: int, changes: dict = None):
    db.add(TrainingAuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        performed_by=performed_by,
        changes=json.dumps(changes) if changes is not None else None,
    ))
    db.commit()


def notify_course_published(db: Session, course: TrainingCourse):
    allocations = db.query(TrainingCourseAllocation).filter(
        TrainingCourseAllocation.course_id == course.id,
        TrainingCourseAllocation.status == "active",
    ).all()
    for alloc in allocations:
        admins = db.query(AccountAdmin).filter(
            AccountAdmin.account_id == alloc.account_id,
            AccountAdmin.role_id == alloc.role_id,
            AccountAdmin.is_active == True,
        ).all()
        for admin in admins:
            db.add(Notification(
                recipient_admin_id=admin.id,
                title="New training course published",
                message=f"{course.name} is now available.",
                entity_type="training_course",
                entity_id=course.id,
            ))
    db.commit()


# --- Pydantic payloads ---
class CoursePayload(BaseModel):
    act_code: str
    name: str
    description: Optional[str] = None
    default_roles: List[str] = []


class ModulePayload(BaseModel):
    module_name: str
    short_description: Optional[str] = None
    department_item_id: Optional[int] = None
    process_item_id: Optional[int] = None
    chapter: Optional[str] = None
    rules: Optional[str] = None
    test_required: bool = False


class ReorderPayload(BaseModel):
    ordered_ids: List[int]


class AllocationPayload(BaseModel):
    account_id: int
    role_id: int
    is_mandatory: bool = True


def serialize_course(c: TrainingCourse) -> dict:
    return {
        "id": c.id,
        "act_code": c.act_code,
        "name": c.name,
        "description": c.description or "",
        "default_roles": json.loads(c.default_roles or "[]"),
        "status": c.status,
        "published_at": c.published_at,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
        "module_count": len(c.modules),
    }


def serialize_content_item(ci: TrainingContentItem) -> dict:
    return {
        "id": ci.id,
        "module_id": ci.module_id,
        "content_type": ci.content_type,
        "title": ci.title,
        "description": ci.description or "",
        "source_type": ci.source_type,
        "file_name": ci.file_name or "",
        "file_type": ci.file_type or "",
        "external_url": ci.external_url or "",
        "sequence_order": ci.sequence_order,
    }


def serialize_module(m: TrainingModule) -> dict:
    return {
        "id": m.id,
        "course_id": m.course_id,
        "module_name": m.module_name,
        "short_description": m.short_description or "",
        "sequence_order": m.sequence_order,
        "department_item_id": m.department_item_id,
        "department_name": m.department_item.item_name if m.department_item else None,
        "process_item_id": m.process_item_id,
        "process_name": m.process_item.item_name if m.process_item else None,
        "chapter": m.chapter or "",
        "rules": m.rules or "",
        "test_required": len(m.assignments) > 0,
        "status": m.status,
        "content_items": [serialize_content_item(ci) for ci in m.content_items],
        "assignments": [serialize_assignment_admin(a) for a in m.assignments],
    }


# --- Roles (for the allocation picker) ---
@router.get("/roles")
def list_roles(db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    roles = db.query(Role).order_by(Role.id.asc()).all()
    return [{"id": r.id, "role_name": r.role_name} for r in roles]


# --- Content Types (a Super-Admin-managed Master Registry, like Acts/Industries) ---
CONTENT_TYPE_DEFAULTS = ["Video", "Audio", "PDF Document", "Word Document", "Excel Spreadsheet", "PowerPoint / Slides", "Image", "Other"]

def ensure_content_types_registry(db: Session) -> MasterRegistry:
    # Seeded unconditionally (not gated by ENABLE_DEMO_SEED) the first time it's
    # needed, same as resources.py's "Sample Policy" section - this is required
    # scaffolding for the Course Builder to function, not demo content.
    reg = db.query(MasterRegistry).filter(MasterRegistry.registry_key == "content_types").first()
    if not reg:
        reg = MasterRegistry(
            registry_key="content_types", display_name="Training Content Types",
            description="Types of content items usable in training modules (video, audio, documents, etc.)",
            is_system=True,
        )
        db.add(reg)
        db.commit()
        db.refresh(reg)
        for name in CONTENT_TYPE_DEFAULTS:
            db.add(MasterRegistryItem(registry_id=reg.id, item_name=name))
        db.commit()
    return reg


@router.get("/content-types")
def list_content_types(db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    reg = ensure_content_types_registry(db)
    items = db.query(MasterRegistryItem).filter(MasterRegistryItem.registry_id == reg.id).order_by(MasterRegistryItem.id.asc()).all()
    return [{"id": i.id, "item_name": i.item_name} for i in items]


# --- Courses ---
@router.get("/courses")
def list_courses(act_code: Optional[str] = None, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    q = db.query(TrainingCourse)
    if act_code:
        q = q.filter(TrainingCourse.act_code == act_code)
    courses = q.order_by(TrainingCourse.id.desc()).all()
    return [serialize_course(c) for c in courses]


@router.post("/courses")
def create_course(payload: CoursePayload, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Course name is required.")
    course = TrainingCourse(
        act_code=payload.act_code,
        name=payload.name.strip(),
        description=(payload.description or "").strip(),
        default_roles=json.dumps(payload.default_roles),
        status="draft",
        created_by=current_admin.id,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    log_audit(db, "course", course.id, "create", current_admin.id, {"name": course.name})
    return serialize_course(course)


@router.get("/courses/{course_id}")
def get_course(course_id: int, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    course = db.query(TrainingCourse).filter(TrainingCourse.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    result = serialize_course(course)
    result["modules"] = [serialize_module(m) for m in course.modules]
    return result


@router.put("/courses/{course_id}")
def update_course(course_id: int, payload: CoursePayload, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    course = db.query(TrainingCourse).filter(TrainingCourse.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Course name is required.")
    course.act_code = payload.act_code
    course.name = payload.name.strip()
    course.description = (payload.description or "").strip()
    course.default_roles = json.dumps(payload.default_roles)
    db.commit()
    db.refresh(course)
    log_audit(db, "course", course.id, "update", current_admin.id, {"name": course.name})
    return serialize_course(course)


@router.delete("/courses/{course_id}")
def delete_course(course_id: int, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    course = db.query(TrainingCourse).filter(TrainingCourse.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    if db.query(TrainingCourseAllocation).filter(TrainingCourseAllocation.course_id == course_id, TrainingCourseAllocation.status == "active").count() > 0:
        raise HTTPException(status_code=400, detail="Cannot delete a course that has active account allocations. Remove allocations first.")

    for module in course.modules:
        for ci in module.content_items:
            if ci.file_path and os.path.exists(ci.file_path):
                try:
                    os.remove(ci.file_path)
                except Exception:
                    pass

    db.delete(course)
    db.commit()
    log_audit(db, "course", course_id, "delete", current_admin.id)
    return {"status": "deleted", "id": course_id}


@router.post("/courses/{course_id}/archive")
def archive_course(course_id: int, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    course = db.query(TrainingCourse).filter(TrainingCourse.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    course.status = "archived"
    db.commit()
    log_audit(db, "course", course.id, "archive", current_admin.id)
    return serialize_course(course)


@router.post("/courses/{course_id}/publish")
def publish_course(course_id: int, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    course = db.query(TrainingCourse).filter(TrainingCourse.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    if not course.modules:
        raise HTTPException(status_code=400, detail="Cannot publish a course with no modules.")
    course.status = "published"
    course.published_at = datetime.utcnow()
    db.commit()
    log_audit(db, "course", course.id, "publish", current_admin.id)
    notify_course_published(db, course)
    return serialize_course(course)


@router.post("/courses/{course_id}/unpublish")
def unpublish_course(course_id: int, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    course = db.query(TrainingCourse).filter(TrainingCourse.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    course.status = "draft"
    db.commit()
    log_audit(db, "course", course.id, "unpublish", current_admin.id)
    return serialize_course(course)


@router.get("/courses/{course_id}/preview")
def preview_course(course_id: int, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    course = db.query(TrainingCourse).filter(TrainingCourse.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    result = serialize_course(course)
    result["modules"] = [serialize_module(m) for m in course.modules]
    return result


# --- Modules ---
@router.post("/courses/{course_id}/modules")
def create_module(course_id: int, payload: ModulePayload, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    course = db.query(TrainingCourse).filter(TrainingCourse.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    if not payload.module_name.strip():
        raise HTTPException(status_code=400, detail="Module name is required.")

    max_order = db.query(TrainingModule).filter(TrainingModule.course_id == course_id).count()
    module = TrainingModule(
        course_id=course_id,
        module_name=payload.module_name.strip(),
        short_description=(payload.short_description or "").strip(),
        sequence_order=max_order + 1,
        department_item_id=payload.department_item_id,
        process_item_id=payload.process_item_id,
        chapter=(payload.chapter or "").strip() or None,
        rules=(payload.rules or "").strip() or None,
        test_required=payload.test_required,
        status="draft",
    )
    db.add(module)
    db.commit()
    db.refresh(module)
    log_audit(db, "module", module.id, "create", current_admin.id, {"module_name": module.module_name, "course_id": course_id})
    return serialize_module(module)


@router.put("/modules/{module_id}")
def update_module(module_id: int, payload: ModulePayload, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    module = db.query(TrainingModule).filter(TrainingModule.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found.")
    if not payload.module_name.strip():
        raise HTTPException(status_code=400, detail="Module name is required.")
    module.module_name = payload.module_name.strip()
    module.short_description = (payload.short_description or "").strip()
    module.department_item_id = payload.department_item_id
    module.process_item_id = payload.process_item_id
    module.chapter = (payload.chapter or "").strip() or None
    module.rules = (payload.rules or "").strip() or None
    module.test_required = payload.test_required
    db.commit()
    db.refresh(module)
    log_audit(db, "module", module.id, "update", current_admin.id, {"module_name": module.module_name})
    return serialize_module(module)


@router.delete("/modules/{module_id}")
def delete_module(module_id: int, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    module = db.query(TrainingModule).filter(TrainingModule.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found.")
    for ci in module.content_items:
        if ci.file_path and os.path.exists(ci.file_path):
            try:
                os.remove(ci.file_path)
            except Exception:
                pass
    course_id = module.course_id
    db.delete(module)
    db.commit()
    log_audit(db, "module", module_id, "delete", current_admin.id, {"course_id": course_id})
    return {"status": "deleted", "id": module_id}


@router.post("/modules/{module_id}/duplicate")
def duplicate_module(module_id: int, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    module = db.query(TrainingModule).filter(TrainingModule.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found.")

    max_order = db.query(TrainingModule).filter(TrainingModule.course_id == module.course_id).count()
    new_module = TrainingModule(
        course_id=module.course_id,
        module_name=f"{module.module_name} (Copy)",
        short_description=module.short_description,
        sequence_order=max_order + 1,
        department_item_id=module.department_item_id,
        process_item_id=module.process_item_id,
        test_required=module.test_required,
        status="draft",
    )
    db.add(new_module)
    db.commit()
    db.refresh(new_module)

    for ci in module.content_items:
        new_file_path = None
        if ci.file_path and os.path.exists(ci.file_path):
            new_name = f"{int(datetime.utcnow().timestamp())}_{ci.file_name}"
            new_dest = UPLOAD_DIR / new_name
            shutil.copyfile(ci.file_path, new_dest)
            new_file_path = str(new_dest)
        db.add(TrainingContentItem(
            module_id=new_module.id,
            content_type=ci.content_type,
            title=ci.title,
            source_type=ci.source_type,
            file_path=new_file_path,
            file_name=ci.file_name,
            file_type=ci.file_type,
            external_url=ci.external_url,
            sequence_order=ci.sequence_order,
        ))
    db.commit()
    db.refresh(new_module)
    log_audit(db, "module", new_module.id, "duplicate", current_admin.id, {"source_module_id": module_id})
    return serialize_module(new_module)


@router.post("/courses/{course_id}/modules/reorder")
def reorder_modules(course_id: int, payload: ReorderPayload, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    modules = {m.id: m for m in db.query(TrainingModule).filter(TrainingModule.course_id == course_id).all()}
    for idx, mod_id in enumerate(payload.ordered_ids, start=1):
        if mod_id in modules:
            modules[mod_id].sequence_order = idx
    db.commit()
    log_audit(db, "course", course_id, "reorder", current_admin.id, {"ordered_ids": payload.ordered_ids})
    return {"status": "reordered"}


# --- Content items ---
@router.post("/modules/{module_id}/content")
def create_content_item(
    module_id: int,
    content_type: str = Form(...),
    title: str = Form(...),
    description: str = Form(""),
    source_type: str = Form("upload"),
    external_url: str = Form(""),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_admin: SuperAdmin = Depends(get_current_super_admin),
):
    module = db.query(TrainingModule).filter(TrainingModule.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found.")
    if not title.strip():
        raise HTTPException(status_code=400, detail="Content title is required.")

    file_path_str = None
    orig_name = None
    f_ext = None

    if source_type == "upload":
        if not file or not file.filename:
            raise HTTPException(status_code=400, detail="A file is required when source type is 'upload'.")
        orig_name = file.filename
        f_ext = orig_name.split(".")[-1].upper() if "." in orig_name else "FILE"
        safe_filename = f"{int(datetime.utcnow().timestamp())}_{orig_name.replace(' ', '_')}"
        save_dest = UPLOAD_DIR / safe_filename
        with open(save_dest, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        file_path_str = str(save_dest)
    elif source_type == "external_url":
        if not external_url.strip():
            raise HTTPException(status_code=400, detail="An external URL is required when source type is 'external_url'.")
    else:
        raise HTTPException(status_code=400, detail="source_type must be 'upload' or 'external_url'.")

    max_order = db.query(TrainingContentItem).filter(TrainingContentItem.module_id == module_id).count()
    ci = TrainingContentItem(
        module_id=module_id,
        content_type=content_type,
        title=title.strip(),
        description=description.strip(),
        source_type=source_type,
        file_path=file_path_str,
        file_name=orig_name,
        file_type=f_ext,
        external_url=external_url.strip() if source_type == "external_url" else None,
        sequence_order=max_order + 1,
    )
    db.add(ci)
    db.commit()
    db.refresh(ci)
    log_audit(db, "content_item", ci.id, "create", current_admin.id, {"title": ci.title, "module_id": module_id})
    return serialize_content_item(ci)


@router.put("/content/{content_id}")
def update_content_item(
    content_id: int,
    content_type: str = Form(...),
    title: str = Form(...),
    description: str = Form(""),
    source_type: str = Form("upload"),
    external_url: str = Form(""),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_admin: SuperAdmin = Depends(get_current_super_admin),
):
    ci = db.query(TrainingContentItem).filter(TrainingContentItem.id == content_id).first()
    if not ci:
        raise HTTPException(status_code=404, detail="Content item not found.")
    if not title.strip():
        raise HTTPException(status_code=400, detail="Content title is required.")

    ci.content_type = content_type
    ci.title = title.strip()
    ci.description = description.strip()
    ci.source_type = source_type

    if source_type == "external_url":
        if not external_url.strip():
            raise HTTPException(status_code=400, detail="An external URL is required when source type is 'external_url'.")
        ci.external_url = external_url.strip()
        if ci.file_path and os.path.exists(ci.file_path):
            try:
                os.remove(ci.file_path)
            except Exception:
                pass
        ci.file_path = None
        ci.file_name = None
        ci.file_type = None
    elif file and file.filename:
        orig_name = file.filename
        f_ext = orig_name.split(".")[-1].upper() if "." in orig_name else "FILE"
        safe_filename = f"{int(datetime.utcnow().timestamp())}_{orig_name.replace(' ', '_')}"
        save_dest = UPLOAD_DIR / safe_filename
        with open(save_dest, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        ci.file_path = str(save_dest)
        ci.file_name = orig_name
        ci.file_type = f_ext
        ci.external_url = None

    db.commit()
    db.refresh(ci)
    log_audit(db, "content_item", ci.id, "update", current_admin.id, {"title": ci.title})
    return serialize_content_item(ci)


@router.delete("/content/{content_id}")
def delete_content_item(content_id: int, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    ci = db.query(TrainingContentItem).filter(TrainingContentItem.id == content_id).first()
    if not ci:
        raise HTTPException(status_code=404, detail="Content item not found.")
    if ci.file_path and os.path.exists(ci.file_path):
        try:
            os.remove(ci.file_path)
        except Exception:
            pass
    module_id = ci.module_id
    db.delete(ci)
    db.commit()
    log_audit(db, "content_item", content_id, "delete", current_admin.id, {"module_id": module_id})
    return {"status": "deleted", "id": content_id}


@router.post("/modules/{module_id}/content/reorder")
def reorder_content_items(module_id: int, payload: ReorderPayload, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    items = {ci.id: ci for ci in db.query(TrainingContentItem).filter(TrainingContentItem.module_id == module_id).all()}
    for idx, ci_id in enumerate(payload.ordered_ids, start=1):
        if ci_id in items:
            items[ci_id].sequence_order = idx
    db.commit()
    log_audit(db, "module", module_id, "reorder", current_admin.id, {"ordered_ids": payload.ordered_ids})
    return {"status": "reordered"}


# --- Allocations ---
@router.get("/courses/{course_id}/allocations")
def list_allocations(course_id: int, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    allocations = db.query(TrainingCourseAllocation).filter(TrainingCourseAllocation.course_id == course_id).all()
    return [{
        "id": a.id,
        "course_id": a.course_id,
        "account_id": a.account_id,
        "account_name": a.account.account_name,
        "account_code": a.account.account_code,
        "role_id": a.role_id,
        "role_name": a.role.role_name,
        "is_mandatory": a.is_mandatory,
        "status": a.status,
        "assigned_at": a.assigned_at,
    } for a in allocations]


@router.post("/courses/{course_id}/allocations")
def create_allocation(course_id: int, payload: AllocationPayload, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    course = db.query(TrainingCourse).filter(TrainingCourse.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    account = db.query(EnterpriseAccount).filter(EnterpriseAccount.id == payload.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found.")
    if not db.query(Role).filter(Role.id == payload.role_id).first():
        raise HTTPException(status_code=404, detail="Role not found.")

    enrolled = {a for (a,) in db.query(AccountEnrolledAct.act_name).filter(AccountEnrolledAct.account_id == account.id).all()}
    if course.act_code not in enrolled:
        raise HTTPException(
            status_code=400,
            detail=f"'{account.account_name}' is not enrolled in {course.act_code}. Enroll this Act for the account in Tab 1 first, then allocate the course.",
        )

    existing = db.query(TrainingCourseAllocation).filter(
        TrainingCourseAllocation.course_id == course_id,
        TrainingCourseAllocation.account_id == payload.account_id,
        TrainingCourseAllocation.role_id == payload.role_id,
    ).first()
    if existing:
        existing.status = "active"
        existing.is_mandatory = payload.is_mandatory
        db.commit()
        db.refresh(existing)
        alloc = existing
    else:
        alloc = TrainingCourseAllocation(
            course_id=course_id,
            account_id=payload.account_id,
            role_id=payload.role_id,
            is_mandatory=payload.is_mandatory,
            status="active",
            created_by=current_admin.id,
        )
        db.add(alloc)
        db.commit()
        db.refresh(alloc)

    log_audit(db, "allocation", alloc.id, "create", current_admin.id, {"course_id": course_id, "account_id": payload.account_id, "role_id": payload.role_id})
    return {"id": alloc.id, "status": "allocated"}


@router.delete("/allocations/{allocation_id}")
def delete_allocation(allocation_id: int, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    alloc = db.query(TrainingCourseAllocation).filter(TrainingCourseAllocation.id == allocation_id).first()
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found.")
    db.delete(alloc)
    db.commit()
    log_audit(db, "allocation", allocation_id, "delete", current_admin.id)
    return {"status": "deleted", "id": allocation_id}


@router.post("/allocations/bulk-csv")
def bulk_allocate_csv(course_id: int = Form(...), file: UploadFile = File(...), db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    """CSV columns: account_code, role_name (course_id passed once for the whole batch)."""
    course = db.query(TrainingCourse).filter(TrainingCourse.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")

    content = file.file.read().decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))

    created, skipped, errors = 0, 0, []
    for row_num, row in enumerate(reader, start=2):
        account_code = (row.get("account_code") or "").strip()
        role_name = (row.get("role_name") or "").strip()
        if not account_code or not role_name:
            errors.append(f"Row {row_num}: missing account_code or role_name.")
            continue

        account = db.query(EnterpriseAccount).filter(EnterpriseAccount.account_code == account_code).first()
        role = db.query(Role).filter(Role.role_name == role_name).first()
        if not account:
            errors.append(f"Row {row_num}: account '{account_code}' not found.")
            continue
        if not role:
            errors.append(f"Row {row_num}: role '{role_name}' not found.")
            continue

        enrolled = {a for (a,) in db.query(AccountEnrolledAct.act_name).filter(AccountEnrolledAct.account_id == account.id).all()}
        if course.act_code not in enrolled:
            errors.append(f"Row {row_num}: '{account_code}' is not enrolled in {course.act_code}. Enroll this Act at Tab 1 first.")
            continue

        existing = db.query(TrainingCourseAllocation).filter(
            TrainingCourseAllocation.course_id == course_id,
            TrainingCourseAllocation.account_id == account.id,
            TrainingCourseAllocation.role_id == role.id,
        ).first()
        if existing:
            skipped += 1
            continue

        db.add(TrainingCourseAllocation(
            course_id=course_id, account_id=account.id, role_id=role.id,
            is_mandatory=True, status="active", created_by=current_admin.id,
        ))
        created += 1

    db.commit()
    log_audit(db, "course", course_id, "bulk_allocate", current_admin.id, {"created": created, "skipped": skipped, "errors": len(errors)})
    return {"created": created, "skipped": skipped, "errors": errors}


# --- Audit log ---
@router.get("/audit-log")
def get_audit_log(entity_type: Optional[str] = None, entity_id: Optional[int] = None, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    q = db.query(TrainingAuditLog)
    if entity_type:
        q = q.filter(TrainingAuditLog.entity_type == entity_type)
    if entity_id:
        q = q.filter(TrainingAuditLog.entity_id == entity_id)
    entries = q.order_by(TrainingAuditLog.id.desc()).limit(200).all()
    return [{
        "id": e.id,
        "entity_type": e.entity_type,
        "entity_id": e.entity_id,
        "action": e.action,
        "performed_by": e.performed_by,
        "changes": json.loads(e.changes) if e.changes else None,
        "created_at": e.created_at,
    } for e in entries]
