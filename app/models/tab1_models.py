from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Date
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database.connection import Base

# --- Dynamic Master Registry Models ---
class MasterRegistry(Base):
    __tablename__ = "master_registries"
    id = Column(Integer, primary_key=True, index=True)
    registry_key = Column(String(100), unique=True, nullable=False) # e.g. 'acts', 'organization_types'
    display_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_system = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    items = relationship("MasterRegistryItem", back_populates="registry", cascade="all, delete-orphan", order_by="MasterRegistryItem.id.asc()")

class MasterRegistryItem(Base):
    __tablename__ = "master_registry_items"
    id = Column(Integer, primary_key=True, index=True)
    registry_id = Column(Integer, ForeignKey("master_registries.id", ondelete="CASCADE"), nullable=False)
    item_code = Column(String(100), nullable=True) # Used for code/short-tag if applicable
    item_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    registry = relationship("MasterRegistry", back_populates="items")


# --- Enterprise Account Models ---
class EnterpriseAccount(Base):
    __tablename__ = "enterprise_accounts"
    id = Column(Integer, primary_key=True, index=True)
    account_code = Column(String(50), unique=True, nullable=False) # ACC-0001
    account_name = Column(String(255), nullable=False)
    location = Column(String(255), nullable=False)
    org_type = Column(String(255), nullable=False)

    project_start_date = Column(Date, nullable=False)
    project_end_date = Column(Date, nullable=False)
    tracking_start_date = Column(Date, nullable=False)
    tracking_end_date = Column(Date, nullable=False)

    ceo_name = Column(String(255), nullable=False)
    ceo_phone = Column(String(50), nullable=False)
    contact_person_name = Column(String(255), nullable=False)
    contact_person_phone = Column(String(50), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    enrolled_acts = relationship("AccountEnrolledAct", back_populates="account", cascade="all, delete-orphan")
    admins = relationship("AccountAdmin", back_populates="account", cascade="all, delete-orphan", order_by="AccountAdmin.id.asc()")


class AccountEnrolledAct(Base):
    __tablename__ = "account_enrolled_acts"
    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("enterprise_accounts.id", ondelete="CASCADE"), nullable=False)
    act_name = Column(String(255), nullable=False)

    account = relationship("EnterpriseAccount", back_populates="enrolled_acts")


class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    role_name = Column(String(50), unique=True, nullable=False)  # "Account Admin", "User"
    description = Column(Text, nullable=True)


class AccountAdmin(Base):
    __tablename__ = "account_admins"
    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("enterprise_accounts.id", ondelete="CASCADE"), nullable=False)
    admin_code = Column(String(50), nullable=False) # ADM-0001 or USR-0001
    name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=False)
    email = Column(String(255), nullable=False)
    password = Column(String(255), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("account_admins.id", ondelete="SET NULL"), nullable=True)
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    job_title = Column(String(255), nullable=True) # e.g. "Compliance Officer"
    role_description = Column(Text, nullable=True)

    account = relationship("EnterpriseAccount", back_populates="admins")
    role = relationship("Role")