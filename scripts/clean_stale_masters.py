"""One-off: find master values still stored on records although the value no
longer exists in its master list (deleted before delete/replace rules existed),
and replace or remove them.

List only (changes nothing):
    venv/bin/python scripts/clean_stale_masters.py

Fix - one --fix per value, "<list key>:<old value>=><new value>" (new value must
exist in that master list) or "<list key>:<old value>=>" to remove it:
    venv/bin/python scripts/clean_stale_masters.py \
        --fix "organization_types:Data Processor=>Healthcare Providers" \
        --fix "organization_types:Enterprise Entity=>" --apply

Without --apply the fixes are previewed and rolled back. Removing a value that is
the only Organization Type on a record, or from a mandatory field, is refused -
use a replacement for those.
"""
import argparse
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import app.main  # noqa: F401,E402
from app.database.connection import SessionLocal  # noqa: E402
from app.models.tab1_models import MasterRegistry, MasterRegistryItem  # noqa: E402
from app.services.master_usage import USAGES, _load, _swap_json  # noqa: E402


def master_names(db, key):
    return {n for (n,) in db.query(MasterRegistryItem.item_name).join(MasterRegistry)
            .filter(MasterRegistry.registry_key == key)}


def stale(db):
    found = Counter()
    for key, usages in USAGES.items():
        if key == "acts":
            continue
        names = master_names(db, key)
        for u in usages:
            if u["kind"] == "fk":
                continue
            q = db.query(u["model"])
            for k, v in u["where"].items():
                q = q.filter(getattr(u["model"], k) == v)
            for row in q.all():
                if u["kind"] == "str":
                    vals = [getattr(row, u["column"])]
                elif u["kind"] == "tasks":
                    vals = [p.get("task_name") for p in _load(row, u) if isinstance(p, dict)]
                else:
                    vals = _load(row, u)
                for v in vals:
                    if v and v != "None" and v not in names:
                        found[(key, v, u["label"])] += 1
    return found


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fix", action="append", default=[])
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    db = SessionLocal()

    print("Leftover values (no longer in their master list):")
    found = stale(db)
    for (key, value, label), n in sorted(found.items()):
        print(f"  {key:20} | {repr(value):37} | {n:4} {label}")
    if not found:
        print("  none")

    for spec in args.fix:
        try:
            left, new = spec.split("=>", 1)
            key, old = left.split(":", 1)
        except ValueError:
            sys.exit(f"Bad --fix '{spec}'. Use 'list_key:Old value=>New value' or 'list_key:Old value=>'.")
        key, old, new = key.strip(), old.strip(), new.strip()
        if key not in USAGES or key == "acts":
            sys.exit(f"Unknown or unsupported list '{key}'.")
        if new and new not in master_names(db, key):
            sys.exit(f"'{new}' is not in the {key} master list.")
        changed = 0
        for u in USAGES[key]:
            if u["kind"] == "fk":
                continue
            q = db.query(u["model"])
            for k, v in u["where"].items():
                q = q.filter(getattr(u["model"], k) == v)
            for row in q.all():
                if u["kind"] == "str":
                    if getattr(row, u["column"]) != old:
                        continue
                    if not new and u["mandatory"]:
                        sys.exit(f"Can't remove '{old}' from {u['label']} (mandatory) - give a replacement.")
                    nullable = getattr(u["model"], u["column"]).property.columns[0].nullable
                    setattr(row, u["column"], new or (None if nullable else ""))
                else:
                    data = _load(row, u)
                    has = any(isinstance(p, dict) and p.get("task_name") == old for p in data) if u["kind"] == "tasks" else old in data
                    if not has:
                        continue
                    if not new and u["min_one"] and len(data) <= 1:
                        sys.exit(f"Can't remove '{old}': it is the only value on some {u['label']} - give a replacement.")
                    _swap_json(row, u, old, new or None)
                changed += 1
        print(f"{'Replace' if new else 'Remove'} '{old}'{' -> ' + new if new else ''}: {changed} record(s)")

    if args.fix and args.apply:
        db.commit()
        print("APPLIED - changes saved.")
    elif args.fix:
        db.rollback()
        print("PREVIEW - nothing saved. Add --apply to save.")


if __name__ == "__main__":
    main()
