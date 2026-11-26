"""One-off cleanup (2026-11-26): move Tab 2 chapters that sit under Acts which are
no longer wanted (deleted HIPAA / IT Act 2000, and GDPR) into DPDPA 2023, delete
blank questions in them, tick Healthcare Providers on DPDPA questions missing it,
and remove GDPR from the Acts master list.

Default is a dry run: everything is done inside a transaction, reported, then
rolled back. Pass --apply to commit.

    venv/bin/python scripts/fix_orphan_acts.py          # preview
    venv/bin/python scripts/fix_orphan_acts.py --apply  # commit
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import app.main  # noqa: F401,E402  (registers every model)
from app.database.connection import SessionLocal  # noqa: E402
from app.models.tab1_models import MasterRegistry, MasterRegistryItem, AccountEnrolledAct  # noqa: E402
from app.models.tab2_models import LegalChapter, LegalSection, LegalAssessment  # noqa: E402

TARGET_ACT = "DPDPA 2023"
REMOVE_ACTS = {"HIPAA", "IT Act 2000", "GDPR"}
ORG_TYPE_TO_TICK = "Healthcare Providers"
APPLY = "--apply" in sys.argv


def strip_acts(raw):
    acts = json.loads(raw or "[]")
    kept = [a for a in acts if a not in REMOVE_ACTS]
    if TARGET_ACT not in kept:
        kept.insert(0, TARGET_ACT)
    return json.dumps(kept), acts != kept


def main():
    db = SessionLocal()
    master_acts = {
        i.item_name: i for i in db.query(MasterRegistryItem)
        .join(MasterRegistry, MasterRegistry.id == MasterRegistryItem.registry_id)
        .filter(MasterRegistry.registry_key == "acts").all()
    }
    if TARGET_ACT not in master_acts:
        sys.exit(f"Stopping: '{TARGET_ACT}' is not in the Acts master list.")
    org_types = {
        n for (n,) in db.query(MasterRegistryItem.item_name)
        .join(MasterRegistry, MasterRegistry.id == MasterRegistryItem.registry_id)
        .filter(MasterRegistry.registry_key == "organization_types").all()
    }
    if ORG_TYPE_TO_TICK not in org_types:
        sys.exit(f"Stopping: '{ORG_TYPE_TO_TICK}' is not in the Organization Types master list.")

    # Chapters under an Act we are removing, or under any Act no longer in the master list.
    moved = [c for c in db.query(LegalChapter).all()
             if c.act_code in REMOVE_ACTS or c.act_code not in master_acts]
    print(f"Chapters to move into {TARGET_ACT}: {len(moved)}")
    blank_deleted = 0
    for chap in moved:
        print(f"  [{chap.act_code}] {chap.title[:60]}")
        chap.act_code = TARGET_ACT
        for rule in chap.rules:
            for sec in rule.sections:
                sec.mapped_acts, _ = strip_acts(sec.mapped_acts)
                for a in list(sec.assessments):
                    if not (a.question or "").strip():
                        print(f"      delete blank question id={a.id} (Rule {rule.rule_order})")
                        db.delete(a)
                        blank_deleted += 1
                    else:
                        a.mapped_acts, _ = strip_acts(a.mapped_acts)
    db.flush()

    # Anywhere else, drop the removed Act names from Acts lists.
    cleaned = 0
    for model in (LegalSection, LegalAssessment):
        for row in db.query(model).all():
            acts = json.loads(row.mapped_acts or "[]")
            if any(a in REMOVE_ACTS for a in acts):
                row.mapped_acts = json.dumps([a for a in acts if a not in REMOVE_ACTS] or [TARGET_ACT])
                cleaned += 1
    print(f"Other Acts lists cleaned: {cleaned}")

    # Tick Healthcare Providers on every DPDPA question that is missing it.
    ticked = []
    for a in (db.query(LegalAssessment).join(LegalSection).join(LegalSection.rule)
              .join(LegalChapter).filter(LegalChapter.act_code == TARGET_ACT).all()):
        orgs = json.loads(a.mapped_org_types or "[]")
        if ORG_TYPE_TO_TICK not in orgs:
            a.mapped_org_types = json.dumps(orgs + [ORG_TYPE_TO_TICK])
            ticked.append(f"id={a.id} Rule {a.section.rule.rule_order}: {(a.question or '')[:60]}")
    print(f"Questions given '{ORG_TYPE_TO_TICK}': {len(ticked)}")
    for t in ticked:
        print("  " + t)

    # Remove the unwanted Acts from the master list and from account enrolments -
    # unless training courses or resources are still filed under them (they would be orphaned).
    from app.models.tab4_models import TrainingCourse
    from app.models.resources import ComplianceSection, ComplianceResource
    for name in sorted(REMOVE_ACTS):
        leftovers = {label: db.query(model).filter(model.act_code == name).count()
                     for label, model in (("training course(s)", TrainingCourse), ("resource section(s)", ComplianceSection), ("resource document(s)", ComplianceResource))}
        leftovers = {k: v for k, v in leftovers.items() if v}
        if leftovers:
            print(f"Act '{name}': NOT removed - still has " + ", ".join(f"{v} {k}" for k, v in leftovers.items()))
            continue
        enrol = db.query(AccountEnrolledAct).filter(AccountEnrolledAct.act_name == name).delete()
        item = master_acts.get(name)
        if item:
            db.delete(item)
        print(f"Act '{name}': master entry {'removed' if item else 'not present'}, {enrol} account enrolment(s) removed")

    print(f"Blank questions deleted: {blank_deleted}")
    if APPLY:
        db.commit()
        print("APPLIED - changes saved.")
    else:
        db.rollback()
        print("DRY RUN - nothing saved. Re-run with --apply to save.")


if __name__ == "__main__":
    main()
