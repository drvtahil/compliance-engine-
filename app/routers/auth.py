from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.database.connection import get_db
from app.models.super_admin import SuperAdmin

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


class LoginPayload(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    name: str
    email: str
    is_superadmin: bool = True


def seed_default_super_admin(db: Session):
    if db.query(SuperAdmin).count() == 0:
        db.add(SuperAdmin(
            name="Super Admin",
            email="admin@mood9.com",
            password=hash_password("12345"),
        ))
        db.commit()


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginPayload, db: Session = Depends(get_db)):
    seed_default_super_admin(db)

    admin = db.query(SuperAdmin).filter(SuperAdmin.email == payload.email.strip().lower()).first()
    if not admin or not verify_password(payload.password, admin.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    token = create_access_token({"sub": str(admin.id)})
    return LoginResponse(access_token=token, name=admin.name, email=admin.email)
