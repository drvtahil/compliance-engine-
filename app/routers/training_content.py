import os
import mimetypes

import jwt as pyjwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.deps import bearer_scheme
from app.core.security import decode_access_token
from app.database.connection import get_db
from app.models.super_admin import SuperAdmin
from app.models.tab1_models import AccountAdmin
from app.models.tab4_models import TrainingContentItem, TrainingCourseAllocation

router = APIRouter(prefix="/api/v1/training/content", tags=["Training Content Files"])


def authorize_content_file_access(db: Session, credentials: HTTPAuthorizationCredentials, content_item: TrainingContentItem):
    """Shared by the Super Admin builder and the Account Admin/User learner
    view. Super Admin can view any content; an Account Admin/User can only
    view content whose course has an active allocation matching their
    account + role."""
    unauthorized = HTTPException(status_code=401, detail="Could not validate credentials")
    try:
        payload = decode_access_token(credentials.credentials)
    except pyjwt.PyJWTError:
        raise unauthorized

    principal = payload.get("principal")
    sub = payload.get("sub")
    if sub is None:
        raise unauthorized

    if principal == "super_admin":
        if not db.query(SuperAdmin).filter(SuperAdmin.id == int(sub)).first():
            raise unauthorized
        return

    if principal == "account_admin":
        admin = db.query(AccountAdmin).filter(AccountAdmin.id == int(sub)).first()
        if not admin or not admin.is_active:
            raise unauthorized
        course_id = content_item.module.course_id
        allocated = db.query(TrainingCourseAllocation).filter(
            TrainingCourseAllocation.course_id == course_id,
            TrainingCourseAllocation.account_id == admin.account_id,
            TrainingCourseAllocation.role_id == admin.role_id,
            TrainingCourseAllocation.status == "active",
        ).first()
        if not allocated:
            raise HTTPException(status_code=403, detail="This training course is not allocated to your account.")
        return

    raise unauthorized


@router.get("/{content_id}/view")
def view_content_file(content_id: int, db: Session = Depends(get_db), credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    ci = db.query(TrainingContentItem).filter(TrainingContentItem.id == content_id).first()
    if not ci or ci.source_type != "upload" or not ci.file_path or not os.path.exists(ci.file_path):
        raise HTTPException(status_code=404, detail="File not found on server.")
    authorize_content_file_access(db, credentials, ci)

    media_type, _ = mimetypes.guess_type(ci.file_path)
    return FileResponse(path=ci.file_path, media_type=media_type or "application/octet-stream", content_disposition_type="inline")


@router.get("/{content_id}/download")
def download_content_file(content_id: int, db: Session = Depends(get_db), credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    ci = db.query(TrainingContentItem).filter(TrainingContentItem.id == content_id).first()
    if not ci or ci.source_type != "upload" or not ci.file_path or not os.path.exists(ci.file_path):
        raise HTTPException(status_code=404, detail="File not found on server.")
    authorize_content_file_access(db, credentials, ci)

    return FileResponse(path=ci.file_path, filename=ci.file_name or "content", content_disposition_type="attachment")
