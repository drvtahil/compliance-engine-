from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_account_admin
from app.core.portal_tabs import PORTAL_TABS
from app.database.connection import get_db
from app.models.tab1_models import AccountAdmin, AccountEnabledTab

router = APIRouter(prefix="/api/v1/account/portal", tags=["Account Portal Tabs"])


@router.get("/tabs")
def my_tabs(db: Session = Depends(get_db), current_admin: AccountAdmin = Depends(get_current_account_admin)):
    """Every tab this person's role can see, each marked active or not. Read fresh
    on each load, so a Super Admin change applies without signing in again."""
    is_admin = current_admin.role.role_name == "Account Admin"
    enabled = {r[0] for r in db.query(AccountEnabledTab.tab_key).filter(AccountEnabledTab.account_id == current_admin.account_id).all()}
    return [
        {"key": t["key"], "label": t["label"], "enabled": t["always_on"] or t["key"] in enabled}
        for t in PORTAL_TABS
        if t["audience"] == "all" or is_admin
    ]
