import json
import mimetypes
import os
import shutil
from datetime import date, datetime
from pathlib import Path
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_account_admin
from app.database.connection import get_db
from app.models.tab1_models import AccountAdmin, AccountEnrolledAct, MasterRegistry
from app.models.tab2_models import LegalAssessment, LegalSection, LegalRule, LegalChapter, QuestionAssignment
from app.models.sops import SopStatus, SopActivity, SopFile

router = APIRouter(prefix="/api/v1/account/sops", tags=["Account Portal SOPs"])

UPLOAD_DIR = Path(settings.upload_dir).resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def is_manager(admin: AccountAdmin) -> bool:
    return admin.role.role_name == "Account Admin"


def assert_act_enrolled(db: Session, account_id: int, act_code: str):
    enrolled = {a for (a,) in db.query(AccountEnrolledAct.act_name).filter(AccountEnrolledAct.account_id == account_id).all()}
    if act_code not in enrolled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This Act is not enrolled for your account.")


def assigned_assessment_ids(db: Session, account_id: int, user_id: int) -> set:
    return {
        a for (a,) in db.query(QuestionAssignment.assessment_id)
        .filter(QuestionAssignment.account_id == account_id, QuestionAssignment.assigned_user_id == user_id)
        .all()
    }


def can_act_on(db: Session, current_admin: AccountAdmin, assessment_id: int) -> bool:
    if is_manager(current_admin):
        return True
    return assessment_id in assigned_assessment_ids(db, current_admin.account_id, current_admin.id)


def visible_assessments_query(db: Session, current_admin: AccountAdmin, act_code: Optional[str] = None):
    q = (
        db.query(LegalAssessment)
        .join(LegalSection, LegalAssessment.section_id == LegalSection.id)
        .join(LegalRule, LegalSection.rule_id == LegalRule.id)
        .join(LegalChapter, LegalRule.chapter_id == LegalChapter.id)
    )
    if act_code:
        q = q.filter(LegalChapter.act_code == act_code)
    if not is_manager(current_admin):
        ids = assigned_assessment_ids(db, current_admin.account_id, current_admin.id)
        q = q.filter(LegalAssessment.id.in_(ids))
    return q


def serialize_owner(admin: Optional[AccountAdmin]) -> Optional[dict]:
    if not admin:
        return None
    return {"id": admin.id, "name": admin.name, "user_code": admin.admin_code}


def serialize_file(f: SopFile) -> dict:
    return {
        "id": f.id,
        "kind": f.kind,
        "name": f.name,
        "description": f.description or "",
        "owner": serialize_owner(f.owner_admin) if f.owner_admin_id else None,
        "version": f.version or "",
        "updated_on": f.updated_on,
        "type_name": f.type_name or "",
        "process_name": f.process_name or "",
        "file_name": f.file_name or "",
        "file_type": f.file_type or "",
        "has_file": bool(f.file_path and os.path.exists(f.file_path)),
        "created_at": f.created_at,
    }


@router.get("")
def list_sops(
    act_code: str,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin),
):
    assert_act_enrolled(db, current_admin.account_id, act_code)
    account_org_type = current_admin.account.org_type

    rows = visible_assessments_query(db, current_admin, act_code).all()
    assignments = {
        a.assessment_id: a for a in db.query(QuestionAssignment).filter(QuestionAssignment.account_id == current_admin.account_id).all()
    }
    statuses = {
        s.assessment_id: s.status for s in db.query(SopStatus).filter(SopStatus.account_id == current_admin.account_id).all()
    }

    result = []
    for a in rows:
        if account_org_type not in json.loads(a.mapped_org_types or "[]"):
            continue
        assignment = assignments.get(a.id)
        files = db.query(SopFile).filter(SopFile.account_id == current_admin.account_id, SopFile.assessment_id == a.id).all()
        result.append({
            "assessment_id": a.id,
            "question": a.question,
            "industries": json.loads(a.industries or "[]"),
            "industry_process": a.industry_process or "",
            "mapped_org_types": json.loads(a.mapped_org_types or "[]"),
            "sop_name": a.sop_name,
            "sop_details": a.sop_details,
            "processes": json.loads(a.processes or "[]"),
            "chapter_title": a.section.rule.chapter.title,
            "rule_order": a.section.rule.rule_order,
            "assigned_user": serialize_owner(assignment.assigned_user) if assignment else None,
            "status": statuses.get(a.id, "Not Compliant"),
            "documents": [serialize_file(f) for f in files if f.kind == "document"],
            "evidence": [serialize_file(f) for f in files if f.kind == "evidence"],
        })
    return result


@router.get("/registries")
def get_upload_registries(
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin),
):
    def items_for(key: str) -> list:
        reg = db.query(MasterRegistry).filter(MasterRegistry.registry_key == key).first()
        return [i.item_name for i in reg.items] if reg else []

    return {
        "document_types": items_for("document_types"),
        "evidence_types": items_for("evidence_types"),
        "processes": items_for("industry_processes"),
    }


@router.get("/assignable-owners")
def assignable_owners(
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin),
):
    admins = db.query(AccountAdmin).filter(
        AccountAdmin.account_id == current_admin.account_id,
        AccountAdmin.is_active == True,
    ).order_by(AccountAdmin.name.asc()).all()
    return [serialize_owner(a) for a in admins]


class StatusPayload(BaseModel):
    status: Literal["Not Compliant", "Compliant", "Not Applicable"]


@router.patch("/{assessment_id}/status")
def set_sop_status(
    assessment_id: int,
    payload: StatusPayload,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin),
):
    if not can_act_on(db, current_admin, assessment_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This SOP is not assigned to you.")

    row = db.query(SopStatus).filter(
        SopStatus.account_id == current_admin.account_id, SopStatus.assessment_id == assessment_id
    ).first()
    if row:
        row.status = payload.status
        row.updated_by = current_admin.id
    else:
        db.add(SopStatus(
            account_id=current_admin.account_id,
            assessment_id=assessment_id,
            status=payload.status,
            updated_by=current_admin.id,
        ))
    db.commit()
    return {"status": "updated", "assessment_id": assessment_id, "sop_status": payload.status}


class ActivityPayload(BaseModel):
    activity_name: str
    detail: str = ""
    owner_admin_id: Optional[int] = None


@router.post("/{assessment_id}/activities")
def create_activity(
    assessment_id: int,
    payload: ActivityPayload,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin),
):
    if not can_act_on(db, current_admin, assessment_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This SOP is not assigned to you.")
    if not payload.activity_name.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Activity name is required.")

    activity = SopActivity(
        account_id=current_admin.account_id,
        assessment_id=assessment_id,
        activity_name=payload.activity_name.strip(),
        detail=payload.detail.strip(),
        owner_admin_id=payload.owner_admin_id,
        created_by=current_admin.id,
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return {"status": "created", "id": activity.id}


@router.get("/activities")
def list_activities(
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin),
):
    q = db.query(SopActivity).filter(SopActivity.account_id == current_admin.account_id)
    if not is_manager(current_admin):
        ids = assigned_assessment_ids(db, current_admin.account_id, current_admin.id)
        q = q.filter(SopActivity.assessment_id.in_(ids))

    activities = q.order_by(SopActivity.created_at.desc()).all()
    return [
        {
            "id": act.id,
            "activity_name": act.activity_name,
            "detail": act.detail or "",
            "sop_name": act.assessment.sop_name,
            "assessment_id": act.assessment_id,
            "owner": serialize_owner(act.owner_admin) if act.owner_admin_id else None,
            "status": act.status,
            "completed_at": act.completed_at,
        }
        for act in activities
    ]


class ActivityStatusPayload(BaseModel):
    status: Literal["Pending", "Completed"]


@router.patch("/activities/{activity_id}/status")
def set_activity_status(
    activity_id: int,
    payload: ActivityStatusPayload,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin),
):
    activity = db.query(SopActivity).filter(
        SopActivity.id == activity_id, SopActivity.account_id == current_admin.account_id
    ).first()
    if not activity:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Activity not found.")
    if not can_act_on(db, current_admin, activity.assessment_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This SOP is not assigned to you.")

    activity.status = payload.status
    activity.completed_at = date.today() if payload.status == "Completed" else None
    db.commit()
    return {"status": "updated", "id": activity_id, "activity_status": activity.status}


@router.post("/{assessment_id}/files")
def upload_sop_file(
    assessment_id: int,
    kind: Literal["document", "evidence"] = Form(...),
    name: str = Form(...),
    description: str = Form(""),
    owner_admin_id: Optional[int] = Form(None),
    version: str = Form(""),
    updated_on: Optional[str] = Form(None),
    type_name: str = Form(""),
    process_name: str = Form(""),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin),
):
    if not can_act_on(db, current_admin, assessment_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This SOP is not assigned to you.")
    if not name.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{kind.capitalize()} name is required.")

    file_path_str = None
    orig_name = None
    f_ext = None
    if file and file.filename:
        orig_name = file.filename
        f_ext = orig_name.split(".")[-1].upper() if "." in orig_name else "FILE"
        safe_filename = f"{int(datetime.utcnow().timestamp())}_{orig_name.replace(' ', '_')}"
        save_dest = UPLOAD_DIR / safe_filename
        with open(save_dest, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        file_path_str = str(save_dest)

    parsed_date = None
    if updated_on:
        try:
            parsed_date = datetime.strptime(updated_on, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "updated_on must be in YYYY-MM-DD format.")

    sop_file = SopFile(
        account_id=current_admin.account_id,
        assessment_id=assessment_id,
        kind=kind,
        name=name.strip(),
        description=description.strip(),
        owner_admin_id=owner_admin_id,
        version=version.strip(),
        updated_on=parsed_date,
        type_name=type_name.strip(),
        process_name=process_name.strip(),
        file_path=file_path_str,
        file_name=orig_name,
        file_type=f_ext,
        uploaded_by=current_admin.id,
    )
    db.add(sop_file)
    db.commit()
    db.refresh(sop_file)
    return serialize_file(sop_file)


def _list_files(db: Session, current_admin: AccountAdmin, act_code: str, kind: str) -> list:
    assert_act_enrolled(db, current_admin.account_id, act_code)
    account_org_type = current_admin.account.org_type

    visible_ids = {a.id for a in visible_assessments_query(db, current_admin, act_code).all()
                   if account_org_type in json.loads(a.mapped_org_types or "[]")}
    if not visible_ids:
        return []

    files = db.query(SopFile).filter(
        SopFile.account_id == current_admin.account_id,
        SopFile.kind == kind,
        SopFile.assessment_id.in_(visible_ids),
    ).order_by(SopFile.id.desc()).all()

    result = []
    for f in files:
        data = serialize_file(f)
        data["sop_name"] = f.assessment.sop_name
        result.append(data)
    return result


@router.get("/documents")
def list_documents(
    act_code: str,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin),
):
    return _list_files(db, current_admin, act_code, "document")


@router.get("/evidence")
def list_evidence(
    act_code: str,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin),
):
    return _list_files(db, current_admin, act_code, "evidence")


def _authorize_file_access(db: Session, current_admin: AccountAdmin, sop_file: SopFile):
    if sop_file.account_id != current_admin.account_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found.")
    if not is_manager(current_admin) and sop_file.assessment_id not in assigned_assessment_ids(db, current_admin.account_id, current_admin.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This file is not accessible to you.")


@router.get("/files/{file_id}/view")
def view_sop_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin),
):
    sop_file = db.query(SopFile).filter(SopFile.id == file_id).first()
    if not sop_file or not sop_file.file_path or not os.path.exists(sop_file.file_path):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found on server.")
    _authorize_file_access(db, current_admin, sop_file)

    media_type, _ = mimetypes.guess_type(sop_file.file_path)
    return FileResponse(path=sop_file.file_path, media_type=media_type or "application/octet-stream", content_disposition_type="inline")


@router.get("/files/{file_id}/download")
def download_sop_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin),
):
    sop_file = db.query(SopFile).filter(SopFile.id == file_id).first()
    if not sop_file or not sop_file.file_path or not os.path.exists(sop_file.file_path):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found on server.")
    _authorize_file_access(db, current_admin, sop_file)

    return FileResponse(path=sop_file.file_path, filename=sop_file.file_name or "document", content_disposition_type="attachment")
