import json
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_account_admin
from app.database.connection import get_db
from app.models.tab1_models import AccountAdmin
from app.models.tab4_models import TrainingAssignment, TrainingAttempt, TrainingAttemptAnswer
from app.routers.account_portal.training import get_allocated_course_ids
from app.services.training_assignments import (
    serialize_assignment_learner, score_answers, is_module_complete, load_answers,
)

router = APIRouter(prefix="/api/v1/account/training", tags=["Account Portal Assignments"])


class AnswerPayload(BaseModel):
    question_id: int
    option_ids: List[int]


def _get_assignment_for_learner(db: Session, assignment_id: int, admin: AccountAdmin) -> TrainingAssignment:
    assignment = db.query(TrainingAssignment).filter(TrainingAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found.")
    module = assignment.module
    if module.course_id not in get_allocated_course_ids(db, admin) or module.course.status != "published":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This course is not allocated to your account.")
    return assignment


def _get_own_attempt(db: Session, attempt_id: int, admin: AccountAdmin) -> TrainingAttempt:
    attempt = db.query(TrainingAttempt).filter(TrainingAttempt.id == attempt_id, TrainingAttempt.admin_id == admin.id).first()
    if not attempt:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attempt not found.")
    return attempt


def _next_attempt_number(db: Session, assignment_id: int, admin_id: int) -> int:
    submitted = db.query(TrainingAttempt).filter(
        TrainingAttempt.assignment_id == assignment_id, TrainingAttempt.admin_id == admin_id,
        TrainingAttempt.status == "submitted",
    ).count()
    return submitted + 1


def _result(attempt: TrainingAttempt) -> dict:
    return {
        "attempt_id": attempt.id,
        "attempt_number": attempt.attempt_number,
        "submitted_at": attempt.submitted_at,
        "score_percent": attempt.score_percent,
        "marks_obtained": attempt.marks_obtained,
        "total_marks": attempt.total_marks,
    }


@router.post("/assignments/{assignment_id}/start")
def start_attempt(assignment_id: int, db: Session = Depends(get_db), current_admin: AccountAdmin = Depends(get_current_account_admin)):
    assignment = _get_assignment_for_learner(db, assignment_id, current_admin)
    if not is_module_complete(db, assignment.module, current_admin.id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Complete every section of this module before taking the assignment.")
    if not assignment.questions:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This assignment has no questions yet.")

    def find_in_progress():
        return db.query(TrainingAttempt).filter(
            TrainingAttempt.assignment_id == assignment_id, TrainingAttempt.admin_id == current_admin.id,
            TrainingAttempt.status == "in_progress",
        ).first()

    attempt = find_in_progress()
    if not attempt:
        attempt = TrainingAttempt(assignment_id=assignment_id, admin_id=current_admin.id, attempt_number=_next_attempt_number(db, assignment_id, current_admin.id))
        db.add(attempt)
        try:
            db.commit()
        except IntegrityError:
            # A simultaneous start already created it; use that one.
            db.rollback()
            attempt = find_in_progress()
        else:
            db.refresh(attempt)

    valid_question_ids = {q.id for q in assignment.questions}
    return {
        "attempt_id": attempt.id,
        "attempt_number": attempt.attempt_number,
        "assignment": serialize_assignment_learner(assignment),
        "answers": {str(qid): opts for qid, opts in load_answers(attempt).items() if qid in valid_question_ids},
    }


@router.put("/attempts/{attempt_id}/answer")
def save_answer(attempt_id: int, payload: AnswerPayload, db: Session = Depends(get_db), current_admin: AccountAdmin = Depends(get_current_account_admin)):
    attempt = _get_own_attempt(db, attempt_id, current_admin)
    if attempt.status != "in_progress":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This attempt has already been submitted.")

    question = next((q for q in attempt.assignment.questions if q.id == payload.question_id), None)
    if not question:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Question does not belong to this assignment.")
    valid_option_ids = {o.id for o in question.options}
    if not set(payload.option_ids) <= valid_option_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid answer choice.")
    if question.question_type == "single" and len(payload.option_ids) > 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only one choice is allowed for this question.")

    row = next((a for a in attempt.answers if a.question_id == payload.question_id), None)
    if not row:
        row = TrainingAttemptAnswer(attempt_id=attempt.id, question_id=payload.question_id)
        attempt.answers.append(row)
    row.selected_option_ids = json.dumps(sorted(set(payload.option_ids)))
    db.commit()
    return {"status": "saved"}


@router.post("/attempts/{attempt_id}/submit")
def submit_attempt(attempt_id: int, db: Session = Depends(get_db), current_admin: AccountAdmin = Depends(get_current_account_admin)):
    attempt = _get_own_attempt(db, attempt_id, current_admin)
    if attempt.status == "submitted":
        return _result(attempt)

    assignment = attempt.assignment
    answers = load_answers(attempt)
    unanswered = [i for i, q in enumerate(assignment.questions, start=1) if not answers.get(q.id)]
    if unanswered:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Answer every question before submitting (unanswered: " + ", ".join(str(n) for n in unanswered) + ").")

    obtained, total, percent = score_answers(assignment, answers)
    attempt.marks_obtained = obtained
    attempt.total_marks = total
    attempt.score_percent = percent
    attempt.attempt_number = _next_attempt_number(db, attempt.assignment_id, current_admin.id)
    attempt.status = "submitted"
    attempt.submitted_at = datetime.utcnow()
    db.commit()
    return _result(attempt)


@router.get("/attempts")
def my_attempts(db: Session = Depends(get_db), current_admin: AccountAdmin = Depends(get_current_account_admin)):
    attempts = db.query(TrainingAttempt).filter(
        TrainingAttempt.admin_id == current_admin.id, TrainingAttempt.status == "submitted",
    ).order_by(TrainingAttempt.submitted_at.desc()).all()

    rows = []
    for a in attempts:
        assignment = a.assignment
        module = assignment.module
        rows.append({
            **_result(a),
            "assignment_id": assignment.id,
            "assignment_title": assignment.title,
            "module_id": module.id,
            "module_name": module.module_name,
            "course_id": module.course_id,
            "course_name": module.course.name,
            "act_code": module.course.act_code,
        })
    return rows
