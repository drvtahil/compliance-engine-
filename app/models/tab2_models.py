from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database.connection import Base

class LegalChapter(Base):
    __tablename__ = "legal_chapters"
    id = Column(Integer, primary_key=True, index=True)
    act_code = Column(String(100), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    rules = relationship("LegalRule", back_populates="chapter", cascade="all, delete-orphan", order_by="LegalRule.rule_order.asc()")

class LegalRule(Base):
    __tablename__ = "legal_rules"
    id = Column(Integer, primary_key=True, index=True)
    chapter_id = Column(Integer, ForeignKey("legal_chapters.id", ondelete="CASCADE"), nullable=False)
    rule_order = Column(Integer, default=1)
    rule_narrative = Column(Text, nullable=False)
    sample_policies = Column(Text, nullable=True) # Stored as JSON string list
    is_hidden = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    chapter = relationship("LegalChapter", back_populates="rules")
    sections = relationship("LegalSection", back_populates="rule", cascade="all, delete-orphan", order_by="LegalSection.id.asc()")

class LegalSection(Base):
    __tablename__ = "legal_sections"
    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("legal_rules.id", ondelete="CASCADE"), nullable=False)
    section_title = Column(String(255), nullable=False)
    section_explanation = Column(Text, nullable=False)
    practical_examples = Column(Text, nullable=True)
    mapped_acts = Column(Text, nullable=True) # Stored as JSON string list
    sub_sections = Column(Text, nullable=True) # Stored as structured JSON string (sub-sections, paras, sub-paras)
    created_at = Column(DateTime, default=datetime.utcnow)

    rule = relationship("LegalRule", back_populates="sections")
    assessments = relationship("LegalAssessment", back_populates="section", cascade="all, delete-orphan", order_by="LegalAssessment.id.asc()")

class LegalAssessment(Base):
    __tablename__ = "legal_assessments"
    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("legal_sections.id", ondelete="CASCADE"), nullable=False)
    question = Column(Text, nullable=False)
    mapped_acts = Column(Text, nullable=True) # Stored as JSON string list
    industries = Column(Text, nullable=True) # Stored as JSON string list
    industry_process = Column(String(255), nullable=False)
    mapped_org_types = Column(Text, nullable=True) # Stored as JSON string list
    sop_name = Column(String(255), nullable=False)
    sop_details = Column(Text, nullable=False)
    processes = Column(Text, nullable=True) # Stored as structured JSON list of processes
    created_at = Column(DateTime, default=datetime.utcnow)

    section = relationship("LegalSection", back_populates="assessments")


class QuestionAssignment(Base):
    __tablename__ = "question_assignments"
    __table_args__ = (UniqueConstraint("account_id", "assessment_id", name="uq_question_assignment_account_assessment"),)
    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("enterprise_accounts.id", ondelete="CASCADE"), nullable=False)
    assessment_id = Column(Integer, ForeignKey("legal_assessments.id", ondelete="CASCADE"), nullable=False)
    assigned_user_id = Column(Integer, ForeignKey("account_admins.id"), nullable=False)
    assigned_by = Column(Integer, ForeignKey("account_admins.id"), nullable=True)
    assigned_at = Column(DateTime, default=datetime.utcnow)
    response = Column(String(10), nullable=True)  # "Yes" | "No" | "NA" | None

    assessment = relationship("LegalAssessment")
    assigned_user = relationship("AccountAdmin", foreign_keys=[assigned_user_id])


class ReadinessSubmission(Base):
    __tablename__ = "readiness_submissions"
    __table_args__ = (UniqueConstraint("account_id", "act_code", name="uq_readiness_submission_account_act"),)
    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("enterprise_accounts.id", ondelete="CASCADE"), nullable=False)
    act_code = Column(String(100), nullable=False)
    submitted_by = Column(Integer, ForeignKey("account_admins.id"), nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)

    submitted_by_admin = relationship("AccountAdmin", foreign_keys=[submitted_by])