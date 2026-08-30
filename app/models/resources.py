from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from datetime import datetime
from app.database.connection import Base

class ComplianceSection(Base):
    __tablename__ = "compliance_sections"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), unique=True, nullable=False)
    is_system = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class ComplianceResource(Base):
    __tablename__ = "resources_documents"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    section_name = Column(String(150), nullable=False, default="Sample Policy")
    description = Column(Text, nullable=True)

    # Stored file metadata
    file_path = Column(Text, nullable=True)
    file_name = Column(String(255), nullable=True)
    file_type = Column(String(50), nullable=True)

    # Master Mappings
    mapped_acts = Column(Text, nullable=True)
    mapped_industry_processes = Column(Text, nullable=True)
    mapped_industries = Column(Text, nullable=True)
    mapped_org_types = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)