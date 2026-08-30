import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.database.connection import get_db
from app.models.super_admin import SuperAdmin

bearer_scheme = HTTPBearer()


def get_current_super_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> SuperAdmin:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Could not validate credentials")
    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.PyJWTError:
        raise unauthorized

    admin_id = payload.get("sub")
    if admin_id is None:
        raise unauthorized

    admin = db.query(SuperAdmin).filter(SuperAdmin.id == int(admin_id)).first()
    if not admin:
        raise unauthorized
    return admin
