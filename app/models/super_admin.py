from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from app.database.connection import Base


class SuperAdmin(Base):
    __tablename__ = "super_admins"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, default="Super Admin")
    email = Column(String(255), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
