from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, UniqueConstraint, Index, text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database.connection import Base


class TrainingCourse(Base):
    __tablename__ = "training_courses"
    id = Column(Integer, primary_key=True, index=True)
    act_code = Column(String(100), nullable=False, index=True)  # matches an item in the "acts" MasterRegistry (Tab 2's convention)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    default_roles = Column(Text, nullable=True)  # JSON string list, e.g. ["Account Admin", "User"]
    status = Column(String(20), nullable=False, default="draft")  # draft | published | archived
    created_by = Column(Integer, ForeignKey("super_admins.id", ondelete="SET NULL"), nullable=True)
    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    modules = relationship("TrainingModule", back_populates="course", cascade="all, delete-orphan", order_by="TrainingModule.sequence_order.asc()")
    allocations = relationship("TrainingCourseAllocation", back_populates="course", cascade="all, delete-orphan")


class TrainingModule(Base):
    __tablename__ = "training_modules"
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("training_courses.id", ondelete="CASCADE"), nullable=False)
    module_name = Column(String(255), nullable=False)
    short_description = Column(Text, nullable=True)
    sequence_order = Column(Integer, default=1)
    department_item_id = Column(Integer, ForeignKey("master_registry_items.id", ondelete="SET NULL"), nullable=True)  # "industries" registry, relabeled Department
    process_item_id = Column(Integer, ForeignKey("master_registry_items.id", ondelete="SET NULL"), nullable=True)  # "industry_processes" registry, relabeled Process
    chapter = Column(String(255), nullable=True)  # free text, not master-list-driven
    rules = Column(Text, nullable=True)  # free text, not master-list-driven
    test_required = Column(Boolean, default=False)  # hook for the future test/assessment engine
    status = Column(String(20), nullable=False, default="draft")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    course = relationship("TrainingCourse", back_populates="modules")
    content_items = relationship("TrainingContentItem", back_populates="module", cascade="all, delete-orphan", order_by="TrainingContentItem.sequence_order.asc()")
    assignments = relationship("TrainingAssignment", back_populates="module", cascade="all, delete-orphan", order_by="TrainingAssignment.sequence_order.asc()")
    department_item = relationship("MasterRegistryItem", foreign_keys=[department_item_id])
    process_item = relationship("MasterRegistryItem", foreign_keys=[process_item_id])


class TrainingContentItem(Base):
    __tablename__ = "training_content_items"
    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("training_modules.id", ondelete="CASCADE"), nullable=False)
    content_type = Column(String(255), nullable=False)  # free text from the "content_types" MasterRegistry
    title = Column(String(255), nullable=False)
    source_type = Column(String(20), nullable=False, default="upload")  # upload | external_url
    description = Column(Text, nullable=True)
    file_path = Column(Text, nullable=True)
    file_name = Column(String(255), nullable=True)
    file_type = Column(String(50), nullable=True)
    external_url = Column(Text, nullable=True)
    sequence_order = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    module = relationship("TrainingModule", back_populates="content_items")


class TrainingContentProgress(Base):
    __tablename__ = "training_content_progress"
    __table_args__ = (UniqueConstraint("admin_id", "content_item_id", name="uq_training_progress_admin_content"),)
    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("account_admins.id", ondelete="CASCADE"), nullable=False)
    content_item_id = Column(Integer, ForeignKey("training_content_items.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), nullable=False, default="not_started")  # not_started | completed
    completed_at = Column(DateTime, nullable=True)

    content_item = relationship("TrainingContentItem")


class TrainingAssignment(Base):
    __tablename__ = "training_assignments"
    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("training_modules.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    sequence_order = Column(Integer, default=1)
    created_by = Column(Integer, ForeignKey("super_admins.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    module = relationship("TrainingModule", back_populates="assignments")
    questions = relationship("TrainingQuestion", back_populates="assignment", cascade="all, delete-orphan", order_by="TrainingQuestion.sequence_order.asc()")


class TrainingQuestion(Base):
    __tablename__ = "training_questions"
    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("training_assignments.id", ondelete="CASCADE"), nullable=False, index=True)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(10), nullable=False, default="single")  # single (radio) | multi (checkbox)
    sequence_order = Column(Integer, default=1)

    assignment = relationship("TrainingAssignment", back_populates="questions")
    options = relationship("TrainingQuestionOption", back_populates="question", cascade="all, delete-orphan", order_by="TrainingQuestionOption.sequence_order.asc()")


class TrainingQuestionOption(Base):
    __tablename__ = "training_question_options"
    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("training_questions.id", ondelete="CASCADE"), nullable=False, index=True)
    option_text = Column(Text, nullable=False)
    is_correct = Column(Boolean, default=False)  # each correct option is worth 1 mark
    sequence_order = Column(Integer, default=1)

    question = relationship("TrainingQuestion", back_populates="options")


class TrainingAttempt(Base):
    __tablename__ = "training_attempts"
    __table_args__ = (
        # At most one unfinished attempt per learner per assignment, even if two
        # "start" requests arrive at the same moment.
        Index("uq_training_attempt_one_in_progress", "assignment_id", "admin_id", unique=True, postgresql_where=text("status = 'in_progress'")),
    )
    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("training_assignments.id", ondelete="CASCADE"), nullable=False, index=True)
    admin_id = Column(Integer, ForeignKey("account_admins.id", ondelete="CASCADE"), nullable=False, index=True)
    attempt_number = Column(Integer, nullable=False, default=1)
    status = Column(String(20), nullable=False, default="in_progress")  # in_progress | submitted
    started_at = Column(DateTime, default=datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)
    marks_obtained = Column(Integer, nullable=True)
    total_marks = Column(Integer, nullable=True)
    score_percent = Column(Integer, nullable=True)

    assignment = relationship("TrainingAssignment")
    answers = relationship("TrainingAttemptAnswer", back_populates="attempt", cascade="all, delete-orphan")


class TrainingAttemptAnswer(Base):
    __tablename__ = "training_attempt_answers"
    __table_args__ = (UniqueConstraint("attempt_id", "question_id", name="uq_training_answer_attempt_question"),)
    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("training_attempts.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(Integer, nullable=False)  # plain int (no FK) so editing an assignment never breaks past attempts
    selected_option_ids = Column(Text, nullable=False, default="[]")  # JSON list of option ids

    attempt = relationship("TrainingAttempt", back_populates="answers")


class TrainingCourseAllocation(Base):
    __tablename__ = "training_course_allocations"
    __table_args__ = (UniqueConstraint("course_id", "account_id", "role_id", name="uq_training_allocation_course_account_role"),)
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("training_courses.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(Integer, ForeignKey("enterprise_accounts.id", ondelete="CASCADE"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    is_mandatory = Column(Boolean, default=True)
    status = Column(String(20), nullable=False, default="active")  # active | inactive
    assigned_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("super_admins.id", ondelete="SET NULL"), nullable=True)

    course = relationship("TrainingCourse", back_populates="allocations")
    account = relationship("EnterpriseAccount")
    role = relationship("Role")


class TrainingAuditLog(Base):
    __tablename__ = "training_audit_log"
    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False)  # course | module | content_item | allocation
    entity_id = Column(Integer, nullable=False)
    action = Column(String(50), nullable=False)  # create | update | delete | publish | unpublish | archive | reorder
    performed_by = Column(Integer, nullable=True)  # super_admins.id
    changes = Column(Text, nullable=True)  # JSON string, before/after
    created_at = Column(DateTime, default=datetime.utcnow)
