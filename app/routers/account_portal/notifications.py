from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_account_admin
from app.database.connection import get_db
from app.models.tab1_models import AccountAdmin
from app.models.notifications import Notification

router = APIRouter(prefix="/api/v1/account/notifications", tags=["Account Portal Notifications"])


@router.get("")
@router.get("/")
def list_notifications(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin),
):
    notes = db.query(Notification).filter(
        Notification.recipient_admin_id == current_admin.id
    ).order_by(Notification.id.desc()).offset(offset).limit(limit).all()
    return [{
        "id": n.id,
        "title": n.title,
        "message": n.message or "",
        "entity_type": n.entity_type,
        "entity_id": n.entity_id,
        "is_read": n.is_read,
        "created_at": n.created_at,
    } for n in notes]


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), current_admin: AccountAdmin = Depends(get_current_account_admin)):
    count = db.query(Notification).filter(
        Notification.recipient_admin_id == current_admin.id, Notification.is_read == False
    ).count()
    return {"unread_count": count}


@router.put("/{notification_id}/read")
def mark_read(notification_id: int, db: Session = Depends(get_db), current_admin: AccountAdmin = Depends(get_current_account_admin)):
    note = db.query(Notification).filter(
        Notification.id == notification_id, Notification.recipient_admin_id == current_admin.id
    ).first()
    if not note:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found.")
    note.is_read = True
    db.commit()
    return {"status": "read", "id": notification_id}


@router.put("/read-all")
def mark_all_read(db: Session = Depends(get_db), current_admin: AccountAdmin = Depends(get_current_account_admin)):
    db.query(Notification).filter(
        Notification.recipient_admin_id == current_admin.id, Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"status": "all_read"}


@router.delete("/clear-read")
def clear_read(db: Session = Depends(get_db), current_admin: AccountAdmin = Depends(get_current_account_admin)):
    """Bulk-delete every already-read notification for this admin - the
    "delete old ones" cleanup action on the notifications page."""
    deleted = db.query(Notification).filter(
        Notification.recipient_admin_id == current_admin.id, Notification.is_read == True
    ).delete()
    db.commit()
    return {"status": "cleared", "deleted": deleted}


@router.delete("/{notification_id}")
def delete_notification(notification_id: int, db: Session = Depends(get_db), current_admin: AccountAdmin = Depends(get_current_account_admin)):
    note = db.query(Notification).filter(
        Notification.id == notification_id, Notification.recipient_admin_id == current_admin.id
    ).first()
    if not note:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found.")
    db.delete(note)
    db.commit()
    return {"status": "deleted", "id": notification_id}
