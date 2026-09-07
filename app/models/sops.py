from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database.connection import Base


class SopStatus(Base):
    # One compliance status per (account, SOP) - not per assigned user, since
    # an Account Admin can act on a SOP even when it isn't assigned to any
    # "User" role account (assign_question only targets the "User" role).
    __tablename__ = "sop_statuses"
    __table_args__ = (UniqueConstraint("account_id", "assessment_id", name="uq_sop_status_account_assessment"),)
    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("enterprise_accounts.id", ondelete="CASCADE"), nullable=False)
    assessment_id = Column(Integer, ForeignKey("legal_assessments.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), nullable=False, default="Not Compliant")  # "Not Compliant" | "Compliant" | "Not Applicable"
    updated_by = Column(Integer, ForeignKey("account_admins.id"), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SopProcessStatus(Base):
    # Per-process completion status within one SOP, for one account. A process
    # row has no stable id of its own (it's an item in LegalAssessment.processes,
    # a JSON list authored by Super Admin) - process_index is its position in
    # that list, the same positional convention the UI already uses ("Process
    # No. 1", "Process No. 2", ...).
    __tablename__ = "sop_process_statuses"
    __table_args__ = (UniqueConstraint("account_id", "assessment_id", "process_index", name="uq_sop_process_status"),)
    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("enterprise_accounts.id", ondelete="CASCADE"), nullable=False)
    assessment_id = Column(Integer, ForeignKey("legal_assessments.id", ondelete="CASCADE"), nullable=False)
    process_index = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, default="Incomplete")  # "Incomplete" | "Complete"
    updated_by = Column(Integer, ForeignKey("account_admins.id"), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SopActivity(Base):
    __tablename__ = "sop_activities"
    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("enterprise_accounts.id", ondelete="CASCADE"), nullable=False)
    assessment_id = Column(Integer, ForeignKey("legal_assessments.id", ondelete="CASCADE"), nullable=False)
    activity_name = Column(String(255), nullable=False)
    detail = Column(Text, nullable=True)
    owner_admin_id = Column(Integer, ForeignKey("account_admins.id"), nullable=True)
    status = Column(String(20), nullable=False, default="Pending")  # "Pending" | "Completed"
    completed_at = Column(Date, nullable=True)
    created_by = Column(Integer, ForeignKey("account_admins.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    assessment = relationship("LegalAssessment")
    owner_admin = relationship("AccountAdmin", foreign_keys=[owner_admin_id])
    created_by_admin = relationship("AccountAdmin", foreign_keys=[created_by])


class SopFile(Base):
    __tablename__ = "sop_files"
    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("enterprise_accounts.id", ondelete="CASCADE"), nullable=False)
    assessment_id = Column(Integer, ForeignKey("legal_assessments.id", ondelete="CASCADE"), nullable=False)
    kind = Column(String(10), nullable=False)  # "document" | "evidence"
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    owner_admin_id = Column(Integer, ForeignKey("account_admins.id"), nullable=True)
    version = Column(String(50), nullable=True)
    updated_on = Column(Date, nullable=True)
    type_name = Column(String(255), nullable=True)
    process_name = Column(String(255), nullable=True)
    file_path = Column(Text, nullable=True)
    file_name = Column(String(255), nullable=True)
    file_type = Column(String(50), nullable=True)
    uploaded_by = Column(Integer, ForeignKey("account_admins.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    assessment = relationship("LegalAssessment")
    owner_admin = relationship("AccountAdmin", foreign_keys=[owner_admin_id])
