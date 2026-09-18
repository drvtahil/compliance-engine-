from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from datetime import datetime
from app.database.connection import Base


class Notification(Base):
    """Generic in-app notification, not tied to training specifically -
    other features can reuse this table by writing their own entity_type."""
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    recipient_admin_id = Column(Integer, ForeignKey("account_admins.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)
    entity_type = Column(String(50), nullable=True)  # e.g. "training_course"
    entity_id = Column(Integer, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
