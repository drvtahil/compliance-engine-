from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
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
    sop_name = Column(String(255), nullable=False)
    sop_details = Column(Text, nullable=False)
    processes = Column(Text, nullable=True) # Stored as structured JSON list of processes
    created_at = Column(DateTime, default=datetime.utcnow)

    section = relationship("LegalSection", back_populates="assessments")