from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_super_admin
from app.database.connection import get_db
from app.models.super_admin import SuperAdmin
from app.models.tab4_models import TrainingModule, TrainingAssignment
from app.routers.tab4_router import log_audit
from app.services.training_assignments import (
    AssignmentPayload, validate_assignment_payload, apply_questions, serialize_assignment_admin,
)

router = APIRouter(prefix="/api/v1/tab4/training", tags=["Tab 4 Training - Assignments"])


@router.post("/modules/{module_id}/assignments")
def create_assignment(module_id: int, payload: AssignmentPayload, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    module = db.query(TrainingModule).filter(TrainingModule.id == module_id).first()
    if not module:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Module not found.")
    validate_assignment_payload(payload)

    assignment = TrainingAssignment(
        module_id=module_id, title=payload.title.strip(), description=payload.description,
        sequence_order=len(module.assignments) + 1, created_by=current_admin.id,
    )
    apply_questions(assignment, payload)
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    log_audit(db, "assignment", assignment.id, "create", current_admin.id, {"module_id": module_id, "title": assignment.title, "questions": len(assignment.questions)})
    return serialize_assignment_admin(assignment)


@router.put("/assignments/{assignment_id}")
def update_assignment(assignment_id: int, payload: AssignmentPayload, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    assignment = db.query(TrainingAssignment).filter(TrainingAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found.")
    validate_assignment_payload(payload)

    assignment.title = payload.title.strip()
    assignment.description = payload.description
    apply_questions(assignment, payload)
    db.commit()
    db.refresh(assignment)
    log_audit(db, "assignment", assignment.id, "update", current_admin.id, {"title": assignment.title, "questions": len(assignment.questions)})
    return serialize_assignment_admin(assignment)


@router.delete("/assignments/{assignment_id}")
def delete_assignment(assignment_id: int, db: Session = Depends(get_db), current_admin: SuperAdmin = Depends(get_current_super_admin)):
    assignment = db.query(TrainingAssignment).filter(TrainingAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found.")
    title = assignment.title
    db.delete(assignment)
    db.commit()
    log_audit(db, "assignment", assignment_id, "delete", current_admin.id, {"title": title})
    return {"status": "deleted"}
