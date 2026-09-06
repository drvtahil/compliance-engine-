import os
import shutil
import json
import mimetypes
from pathlib import Path
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.config import settings
from app.core.deps import get_current_super_admin
from app.database.connection import get_db
from app.models.resources import ComplianceSection, ComplianceResource
from app.models.super_admin import SuperAdmin

router = APIRouter(prefix="/api/v1/resources", tags=["Tab 3 Compliance Resources"])

UPLOAD_DIR = Path(settings.upload_dir).resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

class SectionCreatePayload(BaseModel):
    act_code: str
    name: str

class SectionUpdatePayload(BaseModel):
    new_name: str

def ensure_sample_policy_section(db: Session, act_code: str) -> bool:
    # "Sample Policy" is a fixed system section other endpoints assume always
    # exists per act (see the is_system/name checks in update_section/delete_section) -
    # it's required scaffolding, not demo content, so it's seeded unconditionally
    # the first time a given act's Resources tab is opened. Returns True only the
    # first time it's created for that act, so callers can tell "brand new act"
    # apart from "user deleted everything" - the latter must never re-trigger
    # demo-data seeding.
    sample_sec = db.query(ComplianceSection).filter(
        ComplianceSection.act_code == act_code, ComplianceSection.name == "Sample Policy"
    ).first()
    if not sample_sec:
        sample_sec = ComplianceSection(act_code=act_code, name="Sample Policy", is_system=True)
        db.add(sample_sec)
        db.commit()
        return True
    return False

def seed_demo_tab3_data(db: Session, act_code: str):
    defaults = [
        ComplianceResource(
            title="Customer Privacy Notice Standard",
            act_code=act_code,
            section_name="Sample Policy",
            description="Mandatory itemized notice and multilingual consent template conforming with Section 5 DPDPA 2023.",
            file_name="privacy_notice_template.pdf",
            file_type="PDF",
            mapped_acts=json.dumps(["DPDPA 2023", "GDPR"]),
            mapped_industry_processes=json.dumps(["Customer Onboarding Consent"]),
            mapped_industries=json.dumps(["Healthcare & Life Sciences", "Fintech & Banking"]),
            mapped_org_types=json.dumps(["Data Fiduciary", "Significant Data Fiduciary"])
        ),
        ComplianceResource(
            title="Data Retention & Erasure Policy",
            act_code=act_code,
            section_name="Sample Policy",
            description="Operational standard governing data minimization, retention schedules, and automated deletion.",
            file_name="data_retention_schedule.docx",
            file_type="DOCX",
            mapped_acts=json.dumps(["DPDPA 2023", "IT Act 2000"]),
            mapped_industry_processes=json.dumps(["Third-Party Data Sharing Protocol"]),
            mapped_industries=json.dumps(["SaaS & Cloud Computing"]),
            mapped_org_types=json.dumps(["Data Fiduciary", "Data Processor"])
        )
    ]
    db.add_all(defaults)
    db.commit()

@router.get("/sections")
def get_sections(act_code: str, db: Session = Depends(get_db)):
    is_new_act = ensure_sample_policy_section(db, act_code)
    if is_new_act and settings.enable_demo_seed and act_code == "DPDPA 2023":
        seed_demo_tab3_data(db, act_code)
    sections = db.query(ComplianceSection).filter(ComplianceSection.act_code == act_code).order_by(ComplianceSection.id.asc()).all()
    res = []
    for s in sections:
        doc_count = db.query(ComplianceResource).filter(
            ComplianceResource.act_code == act_code, ComplianceResource.section_name == s.name
        ).count()
        res.append({
            "id": s.id,
            "act_code": s.act_code,
            "name": s.name,
            "is_system": s.is_system,
            "doc_count": doc_count
        })
    return res

@router.post("/sections")
def create_section(payload: SectionCreatePayload, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    trimmed = payload.name.strip()
    if not trimmed:
        raise HTTPException(status_code=400, detail="Section name cannot be empty.")
    if db.query(ComplianceSection).filter(
        ComplianceSection.act_code == payload.act_code, ComplianceSection.name.ilike(trimmed)
    ).first():
        raise HTTPException(status_code=400, detail="A section with this name already exists under this Act.")

    sec = ComplianceSection(act_code=payload.act_code, name=trimmed, is_system=False)
    db.add(sec)
    db.commit()
    db.refresh(sec)
    return sec

@router.put("/sections/{section_id}")
def update_section(section_id: int, payload: SectionUpdatePayload, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    sec = db.query(ComplianceSection).filter(ComplianceSection.id == section_id).first()
    if not sec:
        raise HTTPException(status_code=404, detail="Section not found.")
    if sec.is_system or sec.name == "Sample Policy":
        raise HTTPException(status_code=400, detail="Sample Policy section cannot be renamed.")

    new_name = payload.new_name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Section name cannot be empty.")

    old_name = sec.name
    sec.name = new_name
    db.query(ComplianceResource).filter(
        ComplianceResource.act_code == sec.act_code, ComplianceResource.section_name == old_name
    ).update({"section_name": new_name})
    db.commit()
    db.refresh(sec)
    return sec

@router.delete("/sections/{section_id}")
def delete_section(section_id: int, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    sec = db.query(ComplianceSection).filter(ComplianceSection.id == section_id).first()
    if not sec:
        raise HTTPException(status_code=404, detail="Section not found.")
    if sec.is_system or sec.name == "Sample Policy":
        raise HTTPException(status_code=400, detail="Sample Policy section cannot be deleted.")

    doc_count = db.query(ComplianceResource).filter(
        ComplianceResource.act_code == sec.act_code, ComplianceResource.section_name == sec.name
    ).count()
    if doc_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete section '{sec.name}' because it contains {doc_count} document(s). Delete all documents inside first."
        )

    db.delete(sec)
    db.commit()
    return {"status": "deleted", "id": section_id}

@router.get("")
@router.get("/")
def get_all_resources(act_code: str, db: Session = Depends(get_db)):
    is_new_act = ensure_sample_policy_section(db, act_code)
    if is_new_act and settings.enable_demo_seed and act_code == "DPDPA 2023":
        seed_demo_tab3_data(db, act_code)
    items = db.query(ComplianceResource).filter(ComplianceResource.act_code == act_code).order_by(ComplianceResource.id.desc()).all()
    result = []
    for r in items:
        result.append({
            "id": r.id,
            "title": r.title,
            "section_name": r.section_name,
            "description": r.description or "",
            "file_name": r.file_name or "",
            "file_type": r.file_type or "",
            "has_file": bool(r.file_path and os.path.exists(r.file_path)),
            "mapped_acts": json.loads(r.mapped_acts or "[]"),
            "mapped_industry_processes": json.loads(r.mapped_industry_processes or "[]"),
            "mapped_industries": json.loads(r.mapped_industries or "[]"),
            "mapped_org_types": json.loads(r.mapped_org_types or "[]"),
            "created_at": r.created_at,
            "updated_at": r.updated_at
        })
    return result

@router.post("")
@router.post("/")
def create_resource_with_file(
    title: str = Form(...),
    act_code: str = Form(...),
    section_name: str = Form(...),
    description: str = Form(""),
    mapped_acts: str = Form("[]"),
    mapped_industry_processes: str = Form("[]"),
    mapped_industries: str = Form("[]"),
    mapped_org_types: str = Form("[]"),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_admin: SuperAdmin = Depends(get_current_super_admin)
):
    if not title.strip():
        raise HTTPException(status_code=400, detail="Document title is required.")

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

    res = ComplianceResource(
        title=title.strip(),
        act_code=act_code,
        section_name=section_name.strip(),
        description=description.strip(),
        file_path=file_path_str,
        file_name=orig_name,
        file_type=f_ext,
        mapped_acts=mapped_acts,
        mapped_industry_processes=mapped_industry_processes,
        mapped_industries=mapped_industries,
        mapped_org_types=mapped_org_types
    )
    db.add(res)
    db.commit()
    db.refresh(res)
    return res

@router.put("/{resource_id}")
def update_resource_with_file(
    resource_id: int,
    title: str = Form(...),
    section_name: str = Form(...),
    description: str = Form(""),
    mapped_acts: str = Form("[]"),
    mapped_industry_processes: str = Form("[]"),
    mapped_industries: str = Form("[]"),
    mapped_org_types: str = Form("[]"),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_admin: SuperAdmin = Depends(get_current_super_admin)
):
    res = db.query(ComplianceResource).filter(ComplianceResource.id == resource_id).first()
    if not res:
        raise HTTPException(status_code=404, detail="Document not found.")

    res.title = title.strip()
    res.section_name = section_name.strip()
    res.description = description.strip()
    res.mapped_acts = mapped_acts
    res.mapped_industry_processes = mapped_industry_processes
    res.mapped_industries = mapped_industries
    res.mapped_org_types = mapped_org_types

    if file and file.filename:
        orig_name = file.filename
        f_ext = orig_name.split(".")[-1].upper() if "." in orig_name else "FILE"
        safe_filename = f"{int(datetime.utcnow().timestamp())}_{orig_name.replace(' ', '_')}"
        save_dest = UPLOAD_DIR / safe_filename
        with open(save_dest, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        res.file_path = str(save_dest)
        res.file_name = orig_name
        res.file_type = f_ext

    db.commit()
    db.refresh(res)
    return res

# 1. View Endpoint (Inline Preview)
@router.get("/{resource_id}/view")
def view_document_file(resource_id: int, db: Session = Depends(get_db)):
    res = db.query(ComplianceResource).filter(ComplianceResource.id == resource_id).first()
    if not res or not res.file_path or not os.path.exists(res.file_path):
        raise HTTPException(status_code=404, detail="File not found on server.")
    
    media_type, _ = mimetypes.guess_type(res.file_path)
    return FileResponse(
        path=res.file_path,
        media_type=media_type or "application/octet-stream",
        content_disposition_type="inline"
    )

# 2. Download Endpoint (Attachment)
@router.get("/{resource_id}/download")
def download_document_file(resource_id: int, db: Session = Depends(get_db)):
    res = db.query(ComplianceResource).filter(ComplianceResource.id == resource_id).first()
    if not res or not res.file_path or not os.path.exists(res.file_path):
        raise HTTPException(status_code=404, detail="File not found on server.")
    
    return FileResponse(
        path=res.file_path,
        filename=res.file_name or "document",
        content_disposition_type="attachment"
    )

@router.delete("/{resource_id}")
def delete_resource(resource_id: int, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    res = db.query(ComplianceResource).filter(ComplianceResource.id == resource_id).first()
    if not res:
        raise HTTPException(status_code=404, detail="Document not found.")
    
    if res.file_path and os.path.exists(res.file_path):
        try:
            os.remove(res.file_path)
        except Exception:
            pass

    db.delete(res)
    db.commit()
    return {"status": "deleted", "id": resource_id}