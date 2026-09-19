"""Shared read-only aggregation logic behind both the Super Admin training
dashboard (all accounts) and the Account Admin team dashboard (their own
account only, enforced by always passing account_id). Kept in one place so
both dashboards compute status the same way and can never drift apart."""

from datetime import date, datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.tab1_models import EnterpriseAccount, AccountAdmin, AccountEnrolledAct, Role
from app.models.tab4_models import (
    TrainingCourse, TrainingModule, TrainingContentItem,
    TrainingContentProgress, TrainingCourseAllocation, TrainingAssignment, TrainingAttempt,
)


def get_active_allocations(db: Session, account_id: Optional[int] = None, course_id: Optional[int] = None,
                            act_code: Optional[str] = None, role_id: Optional[int] = None):
    q = db.query(TrainingCourseAllocation).filter(TrainingCourseAllocation.status == "active")
    if account_id is not None:
        q = q.filter(TrainingCourseAllocation.account_id == account_id)
    if course_id is not None:
        q = q.filter(TrainingCourseAllocation.course_id == course_id)
    if role_id is not None:
        q = q.filter(TrainingCourseAllocation.role_id == role_id)
    if act_code:
        q = q.join(TrainingCourse).filter(TrainingCourse.act_code == act_code)
    return q.all()


def get_learners_map(db: Session, pairs: set) -> dict:
    """pairs: set of (account_id, role_id). Returns {(account_id, role_id): [AccountAdmin, ...]} of active learners."""
    if not pairs:
        return {}
    account_ids = {p[0] for p in pairs}
    role_ids = {p[1] for p in pairs}
    admins = db.query(AccountAdmin).filter(
        AccountAdmin.account_id.in_(account_ids),
        AccountAdmin.role_id.in_(role_ids),
        AccountAdmin.is_active == True,
    ).all()
    result = {}
    for a in admins:
        key = (a.account_id, a.role_id)
        if key in pairs:
            result.setdefault(key, []).append(a)
    return result


def get_course_content_map(db: Session, course_ids=None):
    """Returns (course_content: {course_id: [content_id,...]}, module_content: {module_id: [content_id,...]}, modules_by_id: {module_id: TrainingModule})"""
    q = db.query(TrainingModule)
    if course_ids is not None:
        q = q.filter(TrainingModule.course_id.in_(course_ids))
    modules = q.order_by(TrainingModule.sequence_order.asc()).all()

    course_content, module_content, modules_by_id = {}, {}, {}
    for m in modules:
        ids = [ci.id for ci in m.content_items]
        module_content[m.id] = ids
        modules_by_id[m.id] = m
        course_content.setdefault(m.course_id, []).extend(ids)
    return course_content, module_content, modules_by_id


def get_completed_map(db: Session, admin_ids):
    """Returns ({(admin_id, content_id)}, {(admin_id, content_id): completed_at})"""
    if not admin_ids:
        return set(), {}
    rows = db.query(TrainingContentProgress).filter(
        TrainingContentProgress.admin_id.in_(admin_ids),
        TrainingContentProgress.status == "completed",
    ).all()
    completed_set = {(r.admin_id, r.content_item_id) for r in rows}
    completed_at = {(r.admin_id, r.content_item_id): r.completed_at for r in rows}
    return completed_set, completed_at


def compute_status(content_ids, admin_id, completed_set):
    total = len(content_ids)
    if total == 0:
        return "not_started", 0
    done = sum(1 for cid in content_ids if (admin_id, cid) in completed_set)
    if done == 0:
        return "not_started", 0
    if done < total:
        return "in_progress", round(done / total * 100)
    return "completed", 100


def latest_completed_at(content_ids, admin_id, completed_at_map):
    times = [completed_at_map[(admin_id, cid)] for cid in content_ids if (admin_id, cid) in completed_at_map]
    return max(times) if times else None


def build_summary(db: Session, account_id: Optional[int] = None) -> dict:
    allocations = get_active_allocations(db, account_id=account_id)
    if not allocations:
        return {
            "accounts_with_training": 0, "total_users": 0, "total_account_admins": 0,
            "total_courses": 0, "total_acts": 0, "overall_completion_percent": 0,
            "not_started_count": 0, "in_progress_count": 0, "completed_count": 0,
            "mandatory_count": 0, "optional_count": 0,
        }

    course_ids = {a.course_id for a in allocations}
    courses = {c.id: c for c in db.query(TrainingCourse).filter(TrainingCourse.id.in_(course_ids)).all()}
    course_content, _, _ = get_course_content_map(db, course_ids)

    pairs = {(a.account_id, a.role_id) for a in allocations}
    learners_map = get_learners_map(db, pairs)
    all_admin_ids = {a.id for learners in learners_map.values() for a in learners}
    completed_set, _ = get_completed_map(db, all_admin_ids)

    account_ids = set()
    user_admin_ids, account_admin_ids = set(), set()
    not_started = in_progress = completed = mandatory = optional = 0

    for alloc in allocations:
        account_ids.add(alloc.account_id)
        learners = learners_map.get((alloc.account_id, alloc.role_id), [])
        content_ids = course_content.get(alloc.course_id, [])
        for learner in learners:
            if learner.role_id == 2:
                user_admin_ids.add(learner.id)
            else:
                account_admin_ids.add(learner.id)
            status, _ = compute_status(content_ids, learner.id, completed_set)
            if status == "not_started":
                not_started += 1
            elif status == "in_progress":
                in_progress += 1
            else:
                completed += 1
            if alloc.is_mandatory:
                mandatory += 1
            else:
                optional += 1

    total_pairs = not_started + in_progress + completed
    return {
        "accounts_with_training": len(account_ids),
        "total_users": len(user_admin_ids),
        "total_account_admins": len(account_admin_ids),
        "total_courses": len(course_ids),
        "total_acts": len({courses[cid].act_code for cid in course_ids if cid in courses}),
        "overall_completion_percent": round((completed / total_pairs) * 100) if total_pairs else 0,
        "not_started_count": not_started,
        "in_progress_count": in_progress,
        "completed_count": completed,
        "mandatory_count": mandatory,
        "optional_count": optional,
    }


def build_act_tree(db: Session, account_id: Optional[int] = None) -> list:
    """Act -> enrolled accounts -> every active Account Admin/User in that
    account (whether or not training is allocated to them), with the training
    status of those who have been allocated a course under that Act.
    account_id restricts everything to a single account (Account Admin scope)."""
    q = db.query(AccountEnrolledAct)
    if account_id is not None:
        q = q.filter(AccountEnrolledAct.account_id == account_id)
    enrolled = q.all()
    if not enrolled:
        return []

    account_ids = {e.account_id for e in enrolled}
    accounts = {a.id: a for a in db.query(EnterpriseAccount).filter(EnterpriseAccount.id.in_(account_ids)).all()}
    roles = {r.id: r.role_name for r in db.query(Role).all()}
    members_by_account = {}
    for m in db.query(AccountAdmin).filter(AccountAdmin.account_id.in_(account_ids), AccountAdmin.is_active == True).order_by(AccountAdmin.id.asc()).all():
        members_by_account.setdefault(m.account_id, []).append(m)

    allocations = db.query(TrainingCourseAllocation).filter(
        TrainingCourseAllocation.status == "active",
        TrainingCourseAllocation.account_id.in_(account_ids),
    ).all()
    course_ids = {a.course_id for a in allocations}
    courses = {c.id: c for c in db.query(TrainingCourse).filter(TrainingCourse.id.in_(course_ids)).all()} if course_ids else {}
    course_content, module_content, modules_by_id = get_course_content_map(db, course_ids) if course_ids else ({}, {}, {})
    modules_by_course = {}
    for mod in sorted(modules_by_id.values(), key=lambda x: x.sequence_order or 0):
        modules_by_course.setdefault(mod.course_id, []).append(mod)
    member_ids = {m.id for ms in members_by_account.values() for m in ms}
    completed_set, _ = get_completed_map(db, member_ids)

    # Assignments (tests) per module - only ones that have questions, as learners see them
    assignments_by_module = {}
    if modules_by_id:
        for asg in db.query(TrainingAssignment).filter(TrainingAssignment.module_id.in_(modules_by_id.keys())).order_by(TrainingAssignment.sequence_order.asc()).all():
            if asg.questions:
                assignments_by_module.setdefault(asg.module_id, []).append(asg)

    # Submitted attempts per (member, assignment): count and the latest one
    attempt_count = {}
    latest_attempt = {}
    if member_ids:
        for at in db.query(TrainingAttempt).filter(TrainingAttempt.admin_id.in_(member_ids), TrainingAttempt.status == "submitted").all():
            key = (at.admin_id, at.assignment_id)
            attempt_count[key] = attempt_count.get(key, 0) + 1
            if key not in latest_attempt or at.submitted_at > latest_attempt[key].submitted_at:
                latest_attempt[key] = at

    def module_rows(course_id, admin_id):
        rows = []
        for mod in modules_by_course.get(course_id, []):
            ids = module_content.get(mod.id, [])
            status, pct = compute_status(ids, admin_id, completed_set)
            done = sum(1 for cid in ids if (admin_id, cid) in completed_set)
            tests = []
            for asg in assignments_by_module.get(mod.id, []):
                at = latest_attempt.get((admin_id, asg.id))
                tests.append({
                    "assignment_id": asg.id, "title": asg.title,
                    "attempt_count": attempt_count.get((admin_id, asg.id), 0),
                    "latest_score_percent": at.score_percent if at else None,
                    "latest_test_at": at.submitted_at if at else None,
                })
            rows.append({
                "module_id": mod.id, "module_name": mod.module_name, "sequence_order": mod.sequence_order,
                "status": status, "progress_percent": pct, "sections_done": done, "sections_total": len(ids),
                "is_complete": len(ids) > 0 and done == len(ids), "assignments": tests,
            })
        return rows

    allocs_by_key = {}
    for a in allocations:
        course = courses.get(a.course_id)
        if course:
            allocs_by_key.setdefault((a.account_id, a.role_id, course.act_code), []).append(a)

    acts = {}
    for e in enrolled:
        acts.setdefault(e.act_name, set()).add(e.account_id)

    result = []
    for act_name in sorted(acts):
        act_accounts = []
        for account_id in sorted((i for i in acts[act_name] if i in accounts), key=lambda i: accounts[i].account_name.lower()):
            account = accounts[account_id]
            members = []
            counts = {"not_started": 0, "in_progress": 0, "completed": 0}
            for m in members_by_account.get(account_id, []):
                course_rows = []
                for alloc in allocs_by_key.get((account_id, m.role_id, act_name), []):
                    ids = course_content.get(alloc.course_id, [])
                    status, pct = compute_status(ids, m.id, completed_set)
                    course_rows.append({
                        "course_id": alloc.course_id, "course_name": courses[alloc.course_id].name,
                        "status": status, "progress_percent": pct, "is_mandatory": alloc.is_mandatory,
                        "assigned_at": alloc.assigned_at,
                        "sections_done": sum(1 for cid in ids if (m.id, cid) in completed_set), "sections_total": len(ids),
                        "modules": module_rows(alloc.course_id, m.id),
                    })
                if not course_rows:
                    status, pct = "no_training", 0
                else:
                    statuses = {c["status"] for c in course_rows}
                    pct = round(sum(c["progress_percent"] for c in course_rows) / len(course_rows))
                    status = "completed" if statuses == {"completed"} else "not_started" if statuses == {"not_started"} else "in_progress"
                    counts[status] += 1
                members.append({
                    "admin_id": m.id, "name": m.name, "email": m.email,
                    "role_name": roles.get(m.role_id, ""), "has_training": bool(course_rows),
                    "status": status, "progress_percent": pct, "courses": course_rows,
                    "courses_completed": sum(1 for c in course_rows if c["status"] == "completed"),
                })
            act_accounts.append({
                "account_id": account.id, "account_name": account.account_name, "account_code": account.account_code,
                "account_admin_count": sum(1 for m in members if m["role_name"] == "Account Admin"),
                "user_count": sum(1 for m in members if m["role_name"] != "Account Admin"),
                "member_count": len(members),
                "training_count": sum(1 for m in members if m["has_training"]),
                "not_started_count": counts["not_started"], "in_progress_count": counts["in_progress"],
                "completed_count": counts["completed"], "members": members,
            })
        result.append({"act_code": act_name, "account_count": len(act_accounts), "accounts": act_accounts})
    return result


def build_accounts_rollup(db: Session) -> list:
    allocations = get_active_allocations(db)
    if not allocations:
        return []

    by_account = {}
    for a in allocations:
        by_account.setdefault(a.account_id, []).append(a)

    course_ids = {a.course_id for a in allocations}
    courses = {c.id: c for c in db.query(TrainingCourse).filter(TrainingCourse.id.in_(course_ids)).all()}
    course_content, _, _ = get_course_content_map(db, course_ids)

    pairs = {(a.account_id, a.role_id) for a in allocations}
    learners_map = get_learners_map(db, pairs)
    all_admin_ids = {a.id for learners in learners_map.values() for a in learners}
    completed_set, _ = get_completed_map(db, all_admin_ids)

    accounts = {acc.id: acc for acc in db.query(EnterpriseAccount).filter(EnterpriseAccount.id.in_(by_account.keys())).all()}

    result = []
    for account_id, allocs in by_account.items():
        account = accounts.get(account_id)
        if not account:
            continue
        acts = {courses[a.course_id].act_code for a in allocs if a.course_id in courses}
        course_ids_here = {a.course_id for a in allocs}
        user_ids, admin_ids = set(), set()
        completed_pairs = total_pairs = 0
        for alloc in allocs:
            learners = learners_map.get((alloc.account_id, alloc.role_id), [])
            content_ids = course_content.get(alloc.course_id, [])
            for learner in learners:
                (user_ids if learner.role_id == 2 else admin_ids).add(learner.id)
                status, _ = compute_status(content_ids, learner.id, completed_set)
                total_pairs += 1
                if status == "completed":
                    completed_pairs += 1
        result.append({
            "account_id": account.id,
            "account_name": account.account_name,
            "account_code": account.account_code,
            "course_count": len(course_ids_here),
            "act_count": len(acts),
            "user_count": len(user_ids),
            "account_admin_count": len(admin_ids),
            "completion_percent": round((completed_pairs / total_pairs) * 100) if total_pairs else 0,
        })
    return result


def build_courses_rollup(db: Session, account_id: Optional[int] = None) -> list:
    allocations = get_active_allocations(db, account_id=account_id)
    if not allocations:
        return []

    by_course = {}
    for a in allocations:
        by_course.setdefault(a.course_id, []).append(a)

    courses = {c.id: c for c in db.query(TrainingCourse).filter(TrainingCourse.id.in_(by_course.keys())).all()}
    course_content, _, _ = get_course_content_map(db, by_course.keys())

    pairs = {(a.account_id, a.role_id) for a in allocations}
    learners_map = get_learners_map(db, pairs)
    all_admin_ids = {a.id for learners in learners_map.values() for a in learners}
    completed_set, _ = get_completed_map(db, all_admin_ids)

    result = []
    for course_id, allocs in by_course.items():
        course = courses.get(course_id)
        if not course:
            continue
        content_ids = course_content.get(course_id, [])
        account_ids_here = {a.account_id for a in allocs}
        role_names = set()
        learner_ids = set()
        not_started = in_progress = completed = 0
        for alloc in allocs:
            role_names.add("Account Admin" if alloc.role_id == 1 else "User")
            learners = learners_map.get((alloc.account_id, alloc.role_id), [])
            for learner in learners:
                learner_ids.add(learner.id)
                status, _ = compute_status(content_ids, learner.id, completed_set)
                if status == "not_started":
                    not_started += 1
                elif status == "in_progress":
                    in_progress += 1
                else:
                    completed += 1
        result.append({
            "course_id": course.id,
            "course_name": course.name,
            "act_code": course.act_code,
            "status": course.status,
            "accounts_mapped": len(account_ids_here),
            "role_types": sorted(role_names),
            "total_learners": len(learner_ids),
            "not_started_count": not_started,
            "in_progress_count": in_progress,
            "completed_count": completed,
        })
    return result


def build_course_modules_rollup(db: Session, course_id: int, account_id: Optional[int] = None) -> list:
    allocations = get_active_allocations(db, account_id=account_id, course_id=course_id)
    pairs = {(a.account_id, a.role_id) for a in allocations}
    learners_map = get_learners_map(db, pairs)
    all_admin_ids = [a.id for learners in learners_map.values() for a in learners]
    all_admins = [a for learners in learners_map.values() for a in learners]
    completed_set, _ = get_completed_map(db, all_admin_ids)

    modules = db.query(TrainingModule).filter(TrainingModule.course_id == course_id).order_by(TrainingModule.sequence_order.asc()).all()

    result = []
    prev_completed_count = None
    for m in modules:
        content_ids = [ci.id for ci in m.content_items]
        completed_count = 0
        for learner in all_admins:
            status, _ = compute_status(content_ids, learner.id, completed_set)
            if status == "completed":
                completed_count += 1
        total_assigned = len(all_admins)
        drop_off = None
        if prev_completed_count is not None and prev_completed_count > 0:
            drop_off = round(((prev_completed_count - completed_count) / prev_completed_count) * 100)
        result.append({
            "module_id": m.id,
            "module_name": m.module_name,
            "short_description": m.short_description or "",
            "department_name": m.department_item.item_name if m.department_item else None,
            "process_name": m.process_item.item_name if m.process_item else None,
            "chapter": m.chapter or "",
            "rules": m.rules or "",
            "sequence_order": m.sequence_order,
            "total_assigned": total_assigned,
            "completed_count": completed_count,
            "completion_percent": round((completed_count / total_assigned) * 100) if total_assigned else 0,
            "drop_off_percent": drop_off,
        })
        prev_completed_count = completed_count
    return result


def build_records(db: Session, account_id: Optional[int] = None, act_code: Optional[str] = None,
                   course_id: Optional[int] = None, module_id: Optional[int] = None,
                   filter_account_id: Optional[int] = None, role_id: Optional[int] = None,
                   department_item_id: Optional[int] = None, process_item_id: Optional[int] = None,
                   status_filter: Optional[str] = None,
                   assigned_from: Optional[date] = None, assigned_to: Optional[date] = None,
                   completed_from: Optional[date] = None, completed_to: Optional[date] = None) -> list:
    """The one flexible drill-down endpoint. account_id (if given) is the hard
    scope boundary (used by the Account Admin dashboard so it can never see
    other accounts); filter_account_id is an optional extra narrowing filter
    only meaningful on the Super Admin dashboard."""
    effective_account_id = account_id if account_id is not None else filter_account_id
    allocations = get_active_allocations(db, account_id=effective_account_id, course_id=course_id, act_code=act_code, role_id=role_id)
    if not allocations:
        return []

    course_ids = {a.course_id for a in allocations}
    courses = {c.id: c for c in db.query(TrainingCourse).filter(TrainingCourse.id.in_(course_ids)).all()}
    course_content, module_content, modules_by_id = get_course_content_map(db, course_ids)

    account_ids_here = {a.account_id for a in allocations}
    accounts = {acc.id: acc for acc in db.query(EnterpriseAccount).filter(EnterpriseAccount.id.in_(account_ids_here)).all()}

    pairs = {(a.account_id, a.role_id) for a in allocations}
    learners_map = get_learners_map(db, pairs)
    all_admin_ids = {a.id for learners in learners_map.values() for a in learners}
    completed_set, completed_at_map = get_completed_map(db, all_admin_ids)

    # If module_id is given, restrict to that module's content only (module-level rows).
    # Otherwise, if department/process filters are given, restrict to modules matching
    # them and emit one row per matching module; plain course-level rows otherwise.
    target_modules = None
    if module_id is not None:
        target_modules = [modules_by_id[module_id]] if module_id in modules_by_id else []
    elif department_item_id is not None or process_item_id is not None:
        target_modules = [
            m for m in modules_by_id.values()
            if m.course_id in course_ids
            and (department_item_id is None or m.department_item_id == department_item_id)
            and (process_item_id is None or m.process_item_id == process_item_id)
        ]

    rows = []
    for alloc in allocations:
        course = courses.get(alloc.course_id)
        if not course:
            continue
        account = accounts.get(alloc.account_id)
        learners = learners_map.get((alloc.account_id, alloc.role_id), [])
        role_name = "Account Admin" if alloc.role_id == 1 else "User"

        for learner in learners:
            if target_modules is not None:
                for m in target_modules:
                    if m.course_id != course.id:
                        continue
                    content_ids = module_content.get(m.id, [])
                    status, pct = compute_status(content_ids, learner.id, completed_set)
                    rows.append(_build_row(learner, role_name, account, course, m, status, pct, alloc, content_ids, completed_at_map))
            else:
                content_ids = course_content.get(course.id, [])
                status, pct = compute_status(content_ids, learner.id, completed_set)
                rows.append(_build_row(learner, role_name, account, course, None, status, pct, alloc, content_ids, completed_at_map))

    # Post-filter on status/date range (kept simple - computed in Python above, filtered here)
    def keep(r):
        if status_filter and r["status"] != status_filter:
            return False
        if assigned_from and r["assigned_at"] and r["assigned_at"].date() < assigned_from:
            return False
        if assigned_to and r["assigned_at"] and r["assigned_at"].date() > assigned_to:
            return False
        if completed_from and (not r["completed_at"] or r["completed_at"].date() < completed_from):
            return False
        if completed_to and (not r["completed_at"] or r["completed_at"].date() > completed_to):
            return False
        return True

    return [r for r in rows if keep(r)]


def _build_row(learner, role_name, account, course, module, status, pct, alloc, content_ids, completed_at_map):
    return {
        "admin_id": learner.id,
        "admin_name": learner.name,
        "admin_email": learner.email,
        "role_name": role_name,
        "account_id": account.id if account else None,
        "account_name": account.account_name if account else "",
        "course_id": course.id,
        "course_name": course.name,
        "act_code": course.act_code,
        "module_id": module.id if module else None,
        "module_name": module.module_name if module else None,
        "status": status,
        "progress_percent": pct,
        "is_mandatory": alloc.is_mandatory,
        "assigned_at": alloc.assigned_at,
        "completed_at": latest_completed_at(content_ids, learner.id, completed_at_map) if status == "completed" else None,
    }
