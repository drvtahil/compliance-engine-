"""In-app notifications for SOP activities:
- assigned: to the owner when someone else creates the activity for them,
  plus a confirmation to the creator
- due soon: REMINDER_DAYS before the due date, to owner + creator (once)
- overdue: after the due date if still Pending, to owner + creator (once)
- completed: to the creator when the owner marks it Completed

Reminders need no scheduler: check_due() runs whenever a person's bell polls."""
from datetime import date, datetime

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.notifications import Notification
from app.models.sops import SopActivity
from app.services.sop_numbers import sop_ref

REMINDER_DAYS = 2
ENTITY = "sop_activity"


def _fmt(d) -> str:
    return d.strftime("%d %b %Y") if d else "-"


def _sop(act: SopActivity) -> str:
    return f"{sop_ref(act.assessment)} {act.assessment.sop_name}".strip()


def _send(db: Session, recipients, title: str, message: str, act: SopActivity):
    for rid in {r for r in recipients if r}:
        db.add(Notification(recipient_admin_id=rid, title=title, message=message, entity_type=ENTITY, entity_id=act.id))


def on_created(db: Session, act: SopActivity):
    if act.owner_admin_id and act.owner_admin_id != act.created_by:
        by = act.created_by_admin.name if act.created_by_admin else "your Account Admin"
        _send(db, [act.owner_admin_id], f'New activity assigned: "{act.activity_name}"',
              f"{_sop(act)} · Due {_fmt(act.completed_at)} · Assigned by {by}", act)
        owner = act.owner_admin.name if act.owner_admin else "the owner"
        _send(db, [act.created_by], f'You assigned "{act.activity_name}" to {owner}',
              f"{_sop(act)} · Due {_fmt(act.completed_at)}", act)


def on_completed(db: Session, act: SopActivity, completed_by):
    if act.created_by and act.created_by != completed_by.id:
        _send(db, [act.created_by], f'Activity completed: "{act.activity_name}"',
              f"{_sop(act)} · Completed by {completed_by.name} on {_fmt(date.today())}", act)


def check_due(db: Session, admin) -> int:
    """Sends any reminder / overdue notifications that are due for activities this
    person owns or created. Each is sent only once (markers on the activity)."""
    today = date.today()
    sent = 0
    pending = db.query(SopActivity).filter(
        SopActivity.account_id == admin.account_id,
        SopActivity.status == "Pending",
        SopActivity.completed_at.isnot(None),
        or_(SopActivity.owner_admin_id == admin.id, SopActivity.created_by == admin.id),
        or_(SopActivity.reminder_sent_at.is_(None), SopActivity.overdue_sent_at.is_(None)),
    ).all()
    for act in pending:
        days_left = (act.completed_at - today).days
        owner = act.owner_admin.name if act.owner_admin else "Unassigned"
        if days_left < 0 and act.overdue_sent_at is None:
            _send(db, [act.owner_admin_id, act.created_by], f'Activity overdue: "{act.activity_name}"',
                  f"{_sop(act)} · Was due {_fmt(act.completed_at)} · Owner: {owner}", act)
            act.overdue_sent_at = datetime.utcnow()
            act.reminder_sent_at = act.reminder_sent_at or act.overdue_sent_at
            sent += 1
        elif 0 <= days_left <= REMINDER_DAYS and act.reminder_sent_at is None:
            when = "today" if days_left == 0 else "tomorrow" if days_left == 1 else f"in {days_left} days"
            _send(db, [act.owner_admin_id, act.created_by], f'Activity due {when}: "{act.activity_name}"',
                  f"{_sop(act)} · Due {_fmt(act.completed_at)} · Owner: {owner}", act)
            act.reminder_sent_at = datetime.utcnow()
            sent += 1
    if sent:
        db.commit()
    return sent
