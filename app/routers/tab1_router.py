import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime, date

from app.core.config import settings
from app.core.deps import get_current_super_admin
from app.core.security import hash_password
from app.database.connection import get_db
from app.models.super_admin import SuperAdmin
from app.models.tab1_models import (
    MasterRegistry, MasterRegistryItem, EnterpriseAccount, AccountEnrolledAct, AccountAdmin, Role
)
from app.models.tab2_models import LegalRule

router = APIRouter(prefix="/api/v1/tab1", tags=["Tab 1 Master Registries & Accounts"])

# --- Pydantic Request Schemas ---
class MasterRegistryCreate(BaseModel):
    display_name: str
    description: Optional[str] = None

class MasterItemCreate(BaseModel):
    item_name: str
    item_code: Optional[str] = None
    description: Optional[str] = None

class AccountAdminPayload(BaseModel):
    id: Optional[int] = None
    admin_code: Optional[str] = None
    name: str
    phone: str
    email: EmailStr
    password: str = ""

class AccountPayload(BaseModel):
    account_name: str
    location: str
    org_type: str
    project_start_date: date
    project_end_date: date
    tracking_start_date: date
    tracking_end_date: date
    ceo_name: str
    ceo_phone: str
    contact_person_name: str
    contact_person_phone: str
    enrolled_acts: List[str]
    admins: List[AccountAdminPayload]
    removed_admin_ids: List[int] = []


# --- Helper Seed Function ---
def seed_default_registries(db: Session):
    defaults = [
        {"key": "acts", "name": "Acts", "desc": "Regulatory acts and global compliance frameworks", "items": ["DPDPA 2023", "IT Act 2000", "HIPAA", "GDPR"]},
        {"key": "industry_processes", "name": "Industry Processes", "desc": "Core business compliance workflows and pipelines", "items": ["Customer Onboarding Consent", "Third-Party Data Sharing Protocol", "Data Subject Access Request (SAR)", "Incident Breach Escalation"]},
        {"key": "tasks", "name": "Tasks", "desc": "Operational execution and audit task catalog", "items": ["Consent Verification Audit", "Vendor DPA Review", "Data Inventory Mapping", "Access Control Inspection"]},
        {"key": "industries", "name": "Industries", "desc": "Market verticals and business domains", "items": ["Healthcare & Life Sciences", "Fintech & Banking", "E-Commerce & Retail", "SaaS & Cloud Computing", "EdTech"]},
        {"key": "sample_policies", "name": "Sample Policies", "desc": "Mandatory organizational data governance policies", "items": ["Customer Privacy Notice Standard", "Data Retention & Erasure Policy", "Security Incident Handling Standard"]},
        {"key": "organization_types", "name": "Organization Types", "desc": "Statutory entity classifications and fiduciary tiers", "items": ["Data Fiduciary", "Significant Data Fiduciary", "Data Processor", "Enterprise Entity", "Startup / Micro-Entity"]}
    ]

    for d in defaults:
        reg = db.query(MasterRegistry).filter(MasterRegistry.registry_key == d["key"]).first()
        if not reg:
            reg = MasterRegistry(registry_key=d["key"], display_name=d["name"], description=d["desc"], is_system=True)
            db.add(reg)
            db.commit()
            db.refresh(reg)
            for itm in d["items"]:
                db.add(MasterRegistryItem(registry_id=reg.id, item_name=itm))
            db.commit()


# --- Bootstrap / Fetch Everything ---
@router.get("/bootstrap")
def get_bootstrap_data(db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    if settings.enable_demo_seed:
        seed_default_registries(db)

    registries = db.query(MasterRegistry).all()
    reg_list = []
    for r in registries:
        items = db.query(MasterRegistryItem).filter(MasterRegistryItem.registry_id == r.id).order_by(MasterRegistryItem.id.asc()).all()
        reg_list.append({
            "id": r.id,
            "registry_key": r.registry_key,
            "display_name": r.display_name,
            "description": r.description or "",
            "is_system": r.is_system,
            "items": items
        })

    accounts = db.query(EnterpriseAccount).order_by(EnterpriseAccount.id.desc()).all()
    acc_list = []
    today = date.today()

    for a in accounts:
        acts = [ea.act_name for ea in a.enrolled_acts]
        admins = [{
            "id": adm.id,
            "admin_code": adm.admin_code,
            "name": adm.name,
            "phone": adm.phone,
            "email": adm.email
        } for adm in a.admins]

        status_val = "Active" if a.project_end_date >= today else "Inactive"

        acc_list.append({
            "id": a.id,
            "account_code": a.account_code,
            "account_name": a.account_name,
            "location": a.location,
            "org_type": a.org_type,
            "project_start_date": a.project_start_date.isoformat(),
            "project_end_date": a.project_end_date.isoformat(),
            "tracking_start_date": a.tracking_start_date.isoformat(),
            "tracking_end_date": a.tracking_end_date.isoformat(),
            "ceo_name": a.ceo_name,
            "ceo_phone": a.ceo_phone,
            "contact_person_name": a.contact_person_name,
            "contact_person_phone": a.contact_person_phone,
            "status": status_val,
            "enrolled_acts": acts,
            "admins": admins,
            "created_at": a.created_at
        })

    return {
        "registries": reg_list,
        "accounts": acc_list
    }


# --- Dynamic Master Registry Operations ---
@router.post("/registries")
def create_custom_registry(payload: MasterRegistryCreate, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    key = payload.display_name.strip().lower().replace(" ", "_")
    existing = db.query(MasterRegistry).filter(MasterRegistry.registry_key == key).first()
    if existing:
        raise HTTPException(status_code=400, detail="A master registry with this name already exists.")
    
    reg = MasterRegistry(
        registry_key=key, 
        display_name=payload.display_name.strip(), 
        description=payload.description.strip() if payload.description else "", 
        is_system=False
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)
    return reg

@router.put("/registries/{reg_id}")
def update_registry(reg_id: int, payload: MasterRegistryCreate, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    reg = db.query(MasterRegistry).filter(MasterRegistry.id == reg_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Registry not found")
    reg.display_name = payload.display_name.strip()
    reg.description = payload.description.strip() if payload.description else ""
    db.commit()
    return reg

@router.delete("/registries/{reg_id}")
def delete_registry(reg_id: int, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    reg = db.query(MasterRegistry).filter(MasterRegistry.id == reg_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Registry not found")
    if reg.is_system:
        raise HTTPException(status_code=400, detail="Cannot delete default system registries.")
    db.delete(reg)
    db.commit()
    return {"status": "deleted", "id": reg_id}


# --- Master Registry Items Operations with Cascade Clean for Acts ---
def check_duplicate_item_name(db: Session, registry_id: int, item_name: str, exclude_item_id: Optional[int] = None):
    query = db.query(MasterRegistryItem).filter(
        MasterRegistryItem.registry_id == registry_id,
        func.lower(MasterRegistryItem.item_name) == item_name.strip().lower()
    )
    if exclude_item_id:
        query = query.filter(MasterRegistryItem.id != exclude_item_id)
    if query.first():
        raise HTTPException(status_code=400, detail=f"'{item_name.strip()}' already exists in this list.")

@router.post("/registries/{reg_id}/items")
def add_registry_item(reg_id: int, payload: MasterItemCreate, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    reg = db.query(MasterRegistry).filter(MasterRegistry.id == reg_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Registry not found")
    check_duplicate_item_name(db, reg_id, payload.item_name)
    item = MasterRegistryItem(
        registry_id=reg_id,
        item_name=payload.item_name.strip(),
        item_code=payload.item_code.strip() if payload.item_code else None,
        description=payload.description
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

def sync_sample_policy_name(db: Session, old_name: str, new_name: Optional[str]):
    # LegalRule.sample_policies is a JSON-encoded list of policy name strings,
    # not a real relation - unlike AccountEnrolledAct, a rename/delete in the
    # registry can't be synced with a single SQL UPDATE/DELETE. new_name=None
    # means remove the entry entirely (the item was deleted, not renamed).
    rules = db.query(LegalRule).filter(LegalRule.sample_policies.like(f'%{old_name}%')).all()
    for rule in rules:
        names = json.loads(rule.sample_policies or "[]")
        if old_name not in names:
            continue
        updated = [new_name if n == old_name else n for n in names] if new_name else [n for n in names if n != old_name]
        rule.sample_policies = json.dumps(updated)
    db.commit()

@router.put("/registry-items/{item_id}")
def update_registry_item(item_id: int, payload: MasterItemCreate, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    item = db.query(MasterRegistryItem).filter(MasterRegistryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    old_name = item.item_name
    new_name = payload.item_name.strip()
    if new_name.lower() != old_name.lower():
        check_duplicate_item_name(db, item.registry_id, new_name, exclude_item_id=item.id)
    item.item_name = new_name
    item.item_code = payload.item_code.strip() if payload.item_code else item.item_code
    item.description = payload.description

    parent_reg = db.query(MasterRegistry).filter(MasterRegistry.id == item.registry_id).first()
    if parent_reg and old_name != new_name:
        # If an Act is renamed, synchronize with all accounts enrolled in it
        if parent_reg.registry_key == "acts":
            db.query(AccountEnrolledAct).filter(AccountEnrolledAct.act_name == old_name).update({"act_name": new_name})
        # If a Sample Policy is renamed, synchronize with every rule that maps it
        elif parent_reg.registry_key == "sample_policies":
            sync_sample_policy_name(db, old_name, new_name)

    db.commit()
    db.refresh(item)
    return item

@router.delete("/registry-items/{item_id}")
def delete_registry_item(item_id: int, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    item = db.query(MasterRegistryItem).filter(MasterRegistryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    item_name = item.item_name
    parent_reg = db.query(MasterRegistry).filter(MasterRegistry.id == item.registry_id).first()

    if parent_reg and parent_reg.registry_key == "acts":
        # Cascade: If the deleted item is an Act, remove it from all enrolled accounts immediately
        db.query(AccountEnrolledAct).filter(AccountEnrolledAct.act_name == item_name).delete()
    elif parent_reg and parent_reg.registry_key == "sample_policies":
        # Cascade: If the deleted item is a Sample Policy, remove it from every rule that maps it
        sync_sample_policy_name(db, item_name, None)

    db.delete(item)
    db.commit()
    return {"status": "deleted", "id": item_id, "cleaned_act": item_name}


# --- Account Operations (Add & Edit - Deletion Disabled) ---
def get_valid_act_names(db: Session) -> set:
    return {
        name for (name,) in db.query(MasterRegistryItem.item_name)
        .join(MasterRegistry, MasterRegistry.id == MasterRegistryItem.registry_id)
        .filter(MasterRegistry.registry_key == "acts")
        .all()
    }

def validate_enrolled_acts(db: Session, enrolled_acts: List[str]):
    valid_acts = get_valid_act_names(db)
    invalid = sorted(set(enrolled_acts) - valid_acts)
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"These Acts no longer exist in the Master Registry and cannot be enrolled: {', '.join(invalid)}"
        )

def get_account_admin_role_id(db: Session) -> Optional[int]:
    return db.query(Role.id).filter(Role.role_name == "Account Admin").scalar()


def assert_admin_emails_available(db: Session, admins: List["AccountAdminPayload"]):
    """Email is the login identifier for every account_admins row (Account
    Admin or User alike) — login looks a person up by email alone, so two
    rows sharing an email would make login non-deterministic. Reject
    duplicates within this save, and duplicates against any other existing
    row (excluding the row being edited itself)."""
    seen = set()
    for adm in admins:
        email = adm.email.strip().lower()
        if email in seen:
            raise HTTPException(status_code=400, detail=f"'{email}' is used by more than one admin in this form.")
        seen.add(email)

        query = db.query(AccountAdmin).filter(func.lower(AccountAdmin.email) == email)
        if adm.id:
            query = query.filter(AccountAdmin.id != adm.id)
        if query.first():
            raise HTTPException(status_code=400, detail=f"'{email}' is already in use by another admin or user.")


@router.post("/accounts")
def create_account(payload: AccountPayload, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    if not payload.enrolled_acts:
        raise HTTPException(status_code=400, detail="At least one Enrolled Act must be selected.")
    if not payload.admins:
        raise HTTPException(status_code=400, detail="At least one Account Admin must be created.")
    validate_enrolled_acts(db, payload.enrolled_acts)
    if any(not adm.password.strip() for adm in payload.admins):
        raise HTTPException(status_code=400, detail="A password is required for every new Account Admin.")
    assert_admin_emails_available(db, payload.admins)

    last_acc = db.query(EnterpriseAccount).order_by(EnterpriseAccount.id.desc()).first()
    next_num = (last_acc.id + 1) if last_acc else 1
    acc_code = f"ACC-{next_num:04d}"

    acc = EnterpriseAccount(
        account_code=acc_code,
        account_name=payload.account_name.strip(),
        location=payload.location.strip(),
        org_type=payload.org_type.strip(),
        project_start_date=payload.project_start_date,
        project_end_date=payload.project_end_date,
        tracking_start_date=payload.tracking_start_date,
        tracking_end_date=payload.tracking_end_date,
        ceo_name=payload.ceo_name.strip(),
        ceo_phone=payload.ceo_phone.strip(),
        contact_person_name=payload.contact_person_name.strip(),
        contact_person_phone=payload.contact_person_phone.strip()
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)

    for act_name in payload.enrolled_acts:
        db.add(AccountEnrolledAct(account_id=acc.id, act_name=act_name.strip()))

    account_admin_role_id = get_account_admin_role_id(db)
    admin_counter = 1
    for adm in payload.admins:
        adm_code = f"ADM-{admin_counter:04d}"
        db.add(AccountAdmin(
            account_id=acc.id,
            admin_code=adm_code,
            name=adm.name.strip(),
            phone=adm.phone.strip(),
            email=adm.email.strip().lower(),
            password=hash_password(adm.password.strip()),
            role_id=account_admin_role_id,
            is_active=True
        ))
        admin_counter += 1

    db.commit()
    return {"status": "created", "account_code": acc.account_code, "id": acc.id}


@router.put("/accounts/{account_id}")
def update_account(account_id: int, payload: AccountPayload, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    acc = db.query(EnterpriseAccount).filter(EnterpriseAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")

    if not payload.enrolled_acts:
        raise HTTPException(status_code=400, detail="At least one Enrolled Act must be selected.")
    if not payload.admins:
        raise HTTPException(status_code=400, detail="At least one Account Admin is required.")
    validate_enrolled_acts(db, payload.enrolled_acts)
    if any(not adm.id and not adm.password.strip() for adm in payload.admins):
        raise HTTPException(status_code=400, detail="A password is required for every new Account Admin.")
    assert_admin_emails_available(db, payload.admins)

    existing_admins_by_id = {a.id: a for a in acc.admins}

    acc.account_name = payload.account_name.strip()
    acc.location = payload.location.strip()
    acc.org_type = payload.org_type.strip()
    acc.project_start_date = payload.project_start_date
    acc.project_end_date = payload.project_end_date
    acc.tracking_start_date = payload.tracking_start_date
    acc.tracking_end_date = payload.tracking_end_date
    acc.ceo_name = payload.ceo_name.strip()
    acc.ceo_phone = payload.ceo_phone.strip()
    acc.contact_person_name = payload.contact_person_name.strip()
    acc.contact_person_phone = payload.contact_person_phone.strip()

    db.query(AccountEnrolledAct).filter(AccountEnrolledAct.account_id == acc.id).delete()
    for act_name in payload.enrolled_acts:
        db.add(AccountEnrolledAct(account_id=acc.id, act_name=act_name.strip()))

    # Only delete an admin when the frontend explicitly says to remove it
    # (removed_admin_ids). An admin simply absent from payload.admins is left
    # untouched — this form can legitimately be stale relative to admins
    # created elsewhere (e.g. an Account Admin's own "Create User"), and
    # inferring deletion from mere absence previously wiped those out.
    for admin_id in payload.removed_admin_ids:
        existing = existing_admins_by_id.get(admin_id)
        if existing:
            db.delete(existing)

    account_admin_role_id = get_account_admin_role_id(db)
    admin_counter = len(existing_admins_by_id) + 1
    for adm in payload.admins:
        existing = existing_admins_by_id.get(adm.id) if adm.id else None
        if existing:
            existing.name = adm.name.strip()
            existing.phone = adm.phone.strip()
            existing.email = adm.email.strip().lower()
            if not existing.role_id:
                existing.role_id = account_admin_role_id
            if adm.password.strip():
                existing.password = hash_password(adm.password.strip())
        else:
            adm_code = adm.admin_code if adm.admin_code else f"ADM-{admin_counter:04d}"
            db.add(AccountAdmin(
                account_id=acc.id,
                admin_code=adm_code,
                name=adm.name.strip(),
                phone=adm.phone.strip(),
                email=adm.email.strip().lower(),
                password=hash_password(adm.password.strip()),
                role_id=account_admin_role_id,
                is_active=True
            ))
            admin_counter += 1

    db.commit()
    db.refresh(acc)
    return {"status": "updated", "id": acc.id}