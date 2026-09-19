from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_account_admin
from app.database.connection import get_db
from app.models.tab1_models import AccountAdmin
from app.models.tab4_models import (
    TrainingCourse, TrainingModule, TrainingContentItem,
    TrainingContentProgress, TrainingCourseAllocation, TrainingAttempt,
)

router = APIRouter(prefix="/api/v1/account/training", tags=["Account Portal Training"])


def get_allocated_course_ids(db: Session, admin: AccountAdmin) -> set:
    rows = db.query(TrainingCourseAllocation.course_id).filter(
        TrainingCourseAllocation.account_id == admin.account_id,
        TrainingCourseAllocation.role_id == admin.role_id,
        TrainingCourseAllocation.status == "active",
    ).all()
    return {r[0] for r in rows}


@router.get("/courses")
def list_my_courses(db: Session = Depends(get_db), current_admin: AccountAdmin = Depends(get_current_account_admin)):
    course_ids = get_allocated_course_ids(db, current_admin)
    if not course_ids:
        return []

    courses = db.query(TrainingCourse).filter(
        TrainingCourse.id.in_(course_ids), TrainingCourse.status == "published"
    ).order_by(TrainingCourse.id.desc()).all()

    attempted_assignment_ids = {
        r[0] for r in db.query(TrainingAttempt.assignment_id).filter(
            TrainingAttempt.admin_id == current_admin.id, TrainingAttempt.status == "submitted",
        ).all()
    }

    result = []
    for c in courses:
        content_ids = [ci.id for m in c.modules for ci in m.content_items]
        total = len(content_ids)
        completed = 0
        if total:
            completed = db.query(TrainingContentProgress).filter(
                TrainingContentProgress.admin_id == current_admin.id,
                TrainingContentProgress.content_item_id.in_(content_ids),
                TrainingContentProgress.status == "completed",
            ).count()
        result.append({
            "id": c.id,
            "act_code": c.act_code,
            "name": c.name,
            "description": c.description or "",
            "module_count": len(c.modules),
            "content_count": total,
            "completed_count": completed,
            "has_test_required": any(a.questions and a.id not in attempted_assignment_ids for m in c.modules for a in m.assignments),
            "progress_percent": round((completed / total) * 100) if total else 0,
        })
    return result


@router.get("/courses/{course_id}")
def get_my_course(course_id: int, db: Session = Depends(get_db), current_admin: AccountAdmin = Depends(get_current_account_admin)):
    if course_id not in get_allocated_course_ids(db, current_admin):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This course is not allocated to your account.")

    course = db.query(TrainingCourse).filter(TrainingCourse.id == course_id, TrainingCourse.status == "published").first()
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found.")

    all_content_ids = [ci.id for m in course.modules for ci in m.content_items]
    progress_rows = db.query(TrainingContentProgress).filter(
        TrainingContentProgress.admin_id == current_admin.id,
        TrainingContentProgress.content_item_id.in_(all_content_ids),
    ).all() if all_content_ids else []
    completed_ids = {p.content_item_id for p in progress_rows if p.status == "completed"}

    assignment_ids = [a.id for m in course.modules for a in m.assignments]
    attempts_by_assignment = {}
    if assignment_ids:
        for at in db.query(TrainingAttempt).filter(
            TrainingAttempt.admin_id == current_admin.id,
            TrainingAttempt.assignment_id.in_(assignment_ids),
        ).order_by(TrainingAttempt.attempt_number.asc()).all():
            attempts_by_assignment.setdefault(at.assignment_id, []).append(at)

    def assignment_summary(a):
        attempts = attempts_by_assignment.get(a.id, [])
        submitted = [x for x in attempts if x.status == "submitted"]
        latest = submitted[-1] if submitted else None
        return {
            "id": a.id,
            "title": a.title,
            "description": a.description or "",
            "question_count": len(a.questions),
            "attempt_count": len(submitted),
            "has_in_progress": any(x.status == "in_progress" for x in attempts),
            "latest_score_percent": latest.score_percent if latest else None,
            "latest_submitted_at": latest.submitted_at if latest else None,
        }

    modules_out = []
    for m in course.modules:
        content_out = []
        prev_completed = True  # first item in a module is always unlocked
        for ci in m.content_items:
            is_completed = ci.id in completed_ids
            content_out.append({
                "id": ci.id,
                "content_type": ci.content_type,
                "title": ci.title,
                "description": ci.description or "",
                "source_type": ci.source_type,
                "external_url": ci.external_url or "",
                "file_type": ci.file_type or "",
                "sequence_order": ci.sequence_order,
                "is_completed": is_completed,
                "is_unlocked": prev_completed,
            })
            prev_completed = is_completed
        modules_out.append({
            "id": m.id,
            "module_name": m.module_name,
            "short_description": m.short_description or "",
            "sequence_order": m.sequence_order,
            "department_name": m.department_item.item_name if m.department_item else None,
            "process_name": m.process_item.item_name if m.process_item else None,
            "chapter": m.chapter or "",
            "rules": m.rules or "",
            "test_required": len(m.assignments) > 0,
            "assignments": [assignment_summary(a) for a in m.assignments if a.questions],
            "is_complete": len(m.content_items) > 0 and all(ci.id in completed_ids for ci in m.content_items),
            "content_items": content_out,
        })

    return {
        "id": course.id,
        "act_code": course.act_code,
        "name": course.name,
        "description": course.description or "",
        "modules": modules_out,
    }


@router.post("/content/{content_id}/complete")
def mark_content_complete(content_id: int, db: Session = Depends(get_db), current_admin: AccountAdmin = Depends(get_current_account_admin)):
    ci = db.query(TrainingContentItem).filter(TrainingContentItem.id == content_id).first()
    if not ci:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Content item not found.")

    module = ci.module
    if module.course_id not in get_allocated_course_ids(db, current_admin):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This course is not allocated to your account.")

    # Enforce linear progression: every earlier item in the module must already be completed.
    earlier_items = [x for x in module.content_items if x.sequence_order < ci.sequence_order]
    if earlier_items:
        completed_ids = {
            p.content_item_id for p in db.query(TrainingContentProgress).filter(
                TrainingContentProgress.admin_id == current_admin.id,
                TrainingContentProgress.content_item_id.in_([x.id for x in earlier_items]),
                TrainingContentProgress.status == "completed",
            ).all()
        }
        if not all(x.id in completed_ids for x in earlier_items):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Earlier content in this module must be completed first.")

    progress = db.query(TrainingContentProgress).filter(
        TrainingContentProgress.admin_id == current_admin.id,
        TrainingContentProgress.content_item_id == content_id,
    ).first()
    if not progress:
        progress = TrainingContentProgress(admin_id=current_admin.id, content_item_id=content_id)
        db.add(progress)

    progress.status = "completed"
    progress.completed_at = datetime.utcnow()
    db.commit()
    return {"status": "completed", "content_item_id": content_id}
