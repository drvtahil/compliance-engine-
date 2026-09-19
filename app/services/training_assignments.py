"""Shared assignment (test) logic for the Super Admin builder and the learner
screens: serialization, payload validation and scoring."""

import json
from typing import List, Optional

from fastapi import HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.tab4_models import (
    TrainingAssignment, TrainingQuestion, TrainingQuestionOption,
    TrainingContentProgress, TrainingModule,
)


class OptionPayload(BaseModel):
    option_text: str
    is_correct: bool = False


class QuestionPayload(BaseModel):
    question_text: str
    question_type: str = "single"  # single | multi
    options: List[OptionPayload]


class AssignmentPayload(BaseModel):
    title: str
    description: Optional[str] = None
    questions: List[QuestionPayload]


def validate_assignment_payload(payload: AssignmentPayload):
    if not payload.title.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Assignment title is required.")
    if not payload.questions:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Add at least one question.")
    for i, q in enumerate(payload.questions, start=1):
        if not q.question_text.strip():
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Question {i}: question text is required.")
        if q.question_type not in ("single", "multi"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Question {i}: type must be single or multi.")
        options = [o for o in q.options if o.option_text.strip()]
        if len(options) < 2:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Question {i}: add at least two answer choices.")
        correct = sum(1 for o in options if o.is_correct)
        if correct < 1:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Question {i}: mark at least one right choice.")
        if q.question_type == "single" and correct != 1:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Question {i}: a single-choice question must have exactly one right choice.")


def apply_questions(assignment: TrainingAssignment, payload: AssignmentPayload):
    assignment.questions.clear()
    for qi, q in enumerate(payload.questions, start=1):
        question = TrainingQuestion(question_text=q.question_text.strip(), question_type=q.question_type, sequence_order=qi)
        options = [o for o in q.options if o.option_text.strip()]
        for oi, o in enumerate(options, start=1):
            question.options.append(TrainingQuestionOption(option_text=o.option_text.strip(), is_correct=o.is_correct, sequence_order=oi))
        assignment.questions.append(question)


def total_marks(assignment: TrainingAssignment) -> int:
    return sum(1 for q in assignment.questions for o in q.options if o.is_correct)


def serialize_assignment_admin(a: TrainingAssignment) -> dict:
    return {
        "id": a.id,
        "module_id": a.module_id,
        "title": a.title,
        "description": a.description or "",
        "total_marks": total_marks(a),
        "questions": [{
            "id": q.id,
            "question_text": q.question_text,
            "question_type": q.question_type,
            "options": [{"id": o.id, "option_text": o.option_text, "is_correct": o.is_correct} for o in q.options],
        } for q in a.questions],
    }


def serialize_assignment_learner(a: TrainingAssignment) -> dict:
    """Never exposes which options are correct."""
    return {
        "id": a.id,
        "title": a.title,
        "description": a.description or "",
        "questions": [{
            "id": q.id,
            "question_text": q.question_text,
            "question_type": q.question_type,
            "options": [{"id": o.id, "option_text": o.option_text} for o in q.options],
        } for q in a.questions],
    }


def score_answers(assignment: TrainingAssignment, answers: dict):
    """answers: {question_id: [option_id, ...]}. 1 mark per right option picked, no penalty."""
    obtained = 0
    for q in assignment.questions:
        picked = set(answers.get(q.id, []))
        obtained += sum(1 for o in q.options if o.is_correct and o.id in picked)
    total = total_marks(assignment)
    percent = round(obtained / total * 100) if total else 0
    return obtained, total, percent


def is_module_complete(db: Session, module: TrainingModule, admin_id: int) -> bool:
    content_ids = [ci.id for ci in module.content_items]
    if not content_ids:
        return False
    done = db.query(TrainingContentProgress).filter(
        TrainingContentProgress.admin_id == admin_id,
        TrainingContentProgress.content_item_id.in_(content_ids),
        TrainingContentProgress.status == "completed",
    ).count()
    return done == len(content_ids)


def load_answers(attempt) -> dict:
    return {a.question_id: json.loads(a.selected_option_ids or "[]") for a in attempt.answers}
