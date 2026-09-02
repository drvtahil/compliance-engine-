import json
import os

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_account_admin
from app.database.connection import get_db
from app.models.resources import ComplianceResource
from app.models.tab1_models import AccountAdmin

router = APIRouter(prefix="/api/v1/account/resources", tags=["Account Portal Resources"])


@router.get("")
def get_account_resources(
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin),
):
    org_type = current_admin.account.org_type
    items = db.query(ComplianceResource).order_by(ComplianceResource.id.desc()).all()

    result = []
    for r in items:
        if not r.file_path or not os.path.exists(r.file_path):
            continue
        mapped_org_types = json.loads(r.mapped_org_types or "[]")
        if org_type not in mapped_org_types:
            continue
        result.append({
            "id": r.id,
            "title": r.title,
            "section_name": r.section_name,
            "description": r.description or "",
            "file_name": r.file_name or "",
            "file_type": r.file_type or "",
            "mapped_acts": json.loads(r.mapped_acts or "[]"),
            "mapped_industry_processes": json.loads(r.mapped_industry_processes or "[]"),
            "mapped_industries": json.loads(r.mapped_industries or "[]"),
            "mapped_org_types": mapped_org_types,
            "created_at": r.created_at,
        })
    return result
