import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_account_admin
from app.database.connection import get_db
from app.models.tab1_models import AccountAdmin, AccountEnrolledAct, MasterRegistry
from app.models.tab2_models import LegalChapter

router = APIRouter(prefix="/api/v1/account/rules", tags=["Account Portal Rules"])


@router.get("/registry-labels")
def get_registry_labels(
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin),
):
    """Department and Process are Super Admin-managed Master Registry names
    (registry_key "industries" / "industry_processes"), not fixed strings —
    read live so any rename in Tab 1 shows up everywhere without a code
    change."""
    def label_for(key: str, fallback: str) -> str:
        reg = db.query(MasterRegistry).filter(MasterRegistry.registry_key == key).first()
        return reg.display_name if reg else fallback

    return {
        "department_label": label_for("industries", "Department"),
        "process_label": label_for("industry_processes", "Process"),
    }


@router.get("/acts")
def get_enrolled_acts(
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin),
):
    acts = db.query(AccountEnrolledAct).filter(AccountEnrolledAct.account_id == current_admin.account_id).all()
    return [a.act_name for a in acts]


@router.get("/chapters")
def get_chapters_for_account(
    act_code: str,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin),
):
    enrolled = {
        a.act_name for a in
        db.query(AccountEnrolledAct).filter(AccountEnrolledAct.account_id == current_admin.account_id).all()
    }
    if act_code not in enrolled:
        raise HTTPException(status_code=403, detail="This account is not enrolled in the requested act.")

    chapters = db.query(LegalChapter).filter(LegalChapter.act_code == act_code).order_by(LegalChapter.id.asc()).all()

    result = []
    for chap in chapters:
        rules_data = []
        for r in chap.rules:
            if r.is_hidden:
                continue
            sections_data = []
            for s in r.sections:
                sections_data.append({
                    "id": s.id,
                    "section_title": s.section_title,
                    "section_explanation": s.section_explanation,
                    "practical_examples": s.practical_examples or "",
                    "mapped_acts": json.loads(s.mapped_acts or "[]"),
                    "sub_sections": json.loads(s.sub_sections or "[]"),
                })
            rules_data.append({
                "id": r.id,
                "rule_order": r.rule_order,
                "rule_narrative": r.rule_narrative,
                "sample_policies": json.loads(r.sample_policies or "[]"),
                "sections": sections_data,
            })

        if not rules_data:
            continue

        result.append({
            "id": chap.id,
            "act_code": chap.act_code,
            "title": chap.title,
            "rules": rules_data,
        })

    return result
