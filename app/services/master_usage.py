"""Where every master-list value is used, and how delete / replace / rename
keep those records in sync.

Records store master values as copies of the name (or, for training modules,
the item id). Each master list has an entry in USAGES describing those places.
To make a new master list follow the same rules, add its entry here.

Field kinds:
  "str"   - a single text value          (mandatory=True -> can't be removed)
  "json"  - a JSON list of names          (min_one=True  -> a record must keep one)
  "fk"    - a master_registry_items.id
  "tasks" - task_name inside the JSON list of SOP process rows
"""
import json

from sqlalchemy.orm import Session

from app.models.tab1_models import EnterpriseAccount, AccountEnrolledAct
from app.models.tab2_models import LegalChapter, LegalRule, LegalSection, LegalAssessment
from app.models.tab4_models import TrainingCourse, TrainingModule, TrainingContentItem
from app.models.resources import ComplianceSection, ComplianceResource
from app.models.sops import SopFile


def U(label, model, column, kind, mandatory=False, min_one=False, where=None):
    return {"label": label, "model": model, "column": column, "kind": kind,
            "mandatory": mandatory, "min_one": min_one, "where": where or {}}


USAGES = {
    "organization_types": [
        U("account(s) - account Organization Type", EnterpriseAccount, "org_type", "str", mandatory=True),
        U("question(s) in Tab 2", LegalAssessment, "mapped_org_types", "json", min_one=True),
        U("resource document(s) in Tab 3", ComplianceResource, "mapped_org_types", "json", min_one=True),
    ],
    "industries": [  # shown as "Department"
        U("question(s) in Tab 2", LegalAssessment, "industries", "json"),
        U("resource document(s) in Tab 3", ComplianceResource, "mapped_industries", "json"),
        U("training module(s) in Tab 4", TrainingModule, "department_item_id", "fk"),
    ],
    "industry_processes": [  # shown as "Process"
        U("question(s) in Tab 2", LegalAssessment, "industry_process", "str"),
        U("resource document(s) in Tab 3", ComplianceResource, "mapped_industry_processes", "json"),
        U("SOP document(s) / evidence", SopFile, "process_name", "str"),
        U("training module(s) in Tab 4", TrainingModule, "process_item_id", "fk"),
    ],
    "tasks": [
        U("SOP process row(s) in Tab 2", LegalAssessment, "processes", "tasks"),
    ],
    "sample_policies": [
        U("rule(s) in Tab 2", LegalRule, "sample_policies", "json"),
    ],
    "content_types": [
        U("training section(s) in Tab 4", TrainingContentItem, "content_type", "str", mandatory=True),
    ],
    "document_types": [
        U("SOP document(s)", SopFile, "type_name", "str", where={"kind": "document"}),
    ],
    "evidence_types": [
        U("SOP evidence file(s)", SopFile, "type_name", "str", where={"kind": "evidence"}),
    ],
    # Acts: deleting stays blocked while in use (tab1_router); these entries keep a rename in sync.
    "acts": [
        U("chapter(s) in Tab 2", LegalChapter, "act_code", "str", mandatory=True),
        U("section Act mapping(s)", LegalSection, "mapped_acts", "json"),
        U("question Act mapping(s)", LegalAssessment, "mapped_acts", "json"),
        U("resource section(s) in Tab 3", ComplianceSection, "act_code", "str", mandatory=True),
        U("resource document(s) in Tab 3", ComplianceResource, "act_code", "str", mandatory=True),
        U("resource Act mapping(s)", ComplianceResource, "mapped_acts", "json"),
        U("training course(s) in Tab 4", TrainingCourse, "act_code", "str", mandatory=True),
        U("account enrolment(s)", AccountEnrolledAct, "act_name", "str", mandatory=True),
    ],
}


def _rows(db: Session, u: dict, item):
    col = getattr(u["model"], u["column"])
    q = db.query(u["model"])
    for k, v in u["where"].items():
        q = q.filter(getattr(u["model"], k) == v)
    if u["kind"] == "fk":
        return q.filter(col == item.id).all()
    if u["kind"] == "str":
        return q.filter(col == item.item_name).all()
    # json / tasks: narrow with LIKE, then check exactly
    rows = q.filter(col.like(f"%{item.item_name}%")).all()
    return [r for r in rows if _uses(r, u, item.item_name)]


def _load(row, u):
    try:
        return json.loads(getattr(row, u["column"]) or "[]")
    except (TypeError, ValueError):
        return []


def _uses(row, u, name) -> bool:
    data = _load(row, u)
    if u["kind"] == "tasks":
        return any(isinstance(p, dict) and p.get("task_name") == name for p in data)
    return name in data


def usage(db: Session, item, registry_key: str) -> dict:
    """What deleting this value would touch, and whether a plain Remove is allowed."""
    parts, total, remove_blockers = [], 0, []
    for u in USAGES.get(registry_key, []):
        rows = _rows(db, u, item)
        if not rows:
            continue
        n = len(rows)
        total += n
        blocks = False
        if u["mandatory"]:
            blocks = True
        elif u["min_one"]:
            blocks = any(len(_load(r, u)) <= 1 for r in rows)  # this value is their only one
        if blocks:
            remove_blockers.append(u["label"])
        parts.append({"label": u["label"], "count": n, "blocks_remove": blocks})
    return {"total": total, "usages": parts, "can_remove": not remove_blockers, "remove_blockers": remove_blockers}


def _swap_json(row, u, old, new):
    data = _load(row, u)
    if u["kind"] == "tasks":
        for p in data:
            if isinstance(p, dict) and p.get("task_name") == old:
                p["task_name"] = new or "None"
                if not new:
                    p["schedule"] = "None"
                    p["auto_tracking"] = False
    else:
        out = []
        for v in data:
            v = new if v == old else v
            if v and v not in out:
                out.append(v)
        data = out
    setattr(row, u["column"], json.dumps(data))


def apply(db: Session, item, registry_key: str, replacement=None):
    """Replace this value with `replacement` (a MasterRegistryItem) everywhere,
    or remove it when replacement is None. Caller commits."""
    for u in USAGES.get(registry_key, []):
        for row in _rows(db, u, item):
            if u["kind"] == "fk":
                setattr(row, u["column"], replacement.id if replacement else None)
            elif u["kind"] == "str":
                nullable = getattr(u["model"], u["column"]).property.columns[0].nullable
                setattr(row, u["column"], replacement.item_name if replacement else (None if nullable else ""))
            else:
                _swap_json(row, u, item.item_name, replacement.item_name if replacement else None)


def rename(db: Session, item, registry_key: str, old_name: str, new_name: str):
    """Update every copy of old_name to new_name. Caller commits."""
    class _Old:  # look-up by the old name
        id = item.id
        item_name = old_name
    for u in USAGES.get(registry_key, []):
        if u["kind"] == "fk":
            continue  # ids don't change on rename
        for row in _rows(db, u, _Old):
            if u["kind"] == "str":
                setattr(row, u["column"], new_name)
            else:
                _swap_json(row, u, old_name, new_name)
