from datetime import date, datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.deps import get_current_account_admin
from app.core.security import create_access_token, hash_password, verify_password
from app.database.connection import get_db
from app.models.tab1_models import AccountAdmin

router = APIRouter(prefix="/api/v1/account/auth", tags=["Account Portal Auth"])


class LoginPayload(BaseModel):
    email: EmailStr
    password: str
    login_as: Optional[Literal["admin", "user"]] = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    id: int
    name: str
    email: str
    role: str
    job_title: str = ""
    account_id: int
    account_name: str


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginPayload, db: Session = Depends(get_db)):
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password.")

    admin = db.query(AccountAdmin).filter(AccountAdmin.email == payload.email.strip().lower()).first()
    if not admin or not verify_password(payload.password, admin.password):
        raise unauthorized
    if not admin.is_active:
        raise unauthorized
    if admin.account.project_end_date < date.today():
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account's access period has ended.")

    actual_role = admin.role.role_name
    if payload.login_as == "admin" and actual_role != "Account Admin":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "This is not an Account Admin login. Use the User tab to sign in.")
    if payload.login_as == "user" and actual_role != "User":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "This is not a User login. Use the Account Admin tab to sign in.")

    admin.last_login_at = datetime.utcnow()
    db.commit()

    token = create_access_token({"sub": str(admin.id), "principal": "account_admin"})
    return LoginResponse(
        access_token=token,
        id=admin.id,
        name=admin.name,
        email=admin.email,
        role=admin.role.role_name,
        job_title=admin.job_title or "",
        account_id=admin.account_id,
        account_name=admin.account.account_name,
    )


class ChangePasswordPayload(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
def change_password(
    payload: ChangePasswordPayload,
    db: Session = Depends(get_db),
    current_admin: AccountAdmin = Depends(get_current_account_admin),
):
    if not verify_password(payload.current_password, current_admin.password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect.")
    if len(payload.new_password.strip()) < 6:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "New password must be at least 6 characters.")

    current_admin.password = hash_password(payload.new_password.strip())
    db.commit()
    return {"status": "password_updated"}
