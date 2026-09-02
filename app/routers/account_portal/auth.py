from datetime import date, datetime

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


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    name: str
    email: str
    role: str
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

    admin.last_login_at = datetime.utcnow()
    db.commit()

    token = create_access_token({"sub": str(admin.id), "principal": "account_admin"})
    return LoginResponse(
        access_token=token,
        name=admin.name,
        email=admin.email,
        role=admin.role.role_name if admin.role else "Account Admin",
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
