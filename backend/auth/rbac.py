from dataclasses import dataclass
from typing import List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.auth.jwt import verify_token
from backend.auth.models import User, RoleCollection
from backend.db.session import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


@dataclass
class UserContext:
    user_id: str
    email: str
    role: str
    allowed_collections: List[str]
    tenant_id: str = "default_tenant"


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> UserContext:
    payload = verify_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    # Admin gets all collections via wildcard marker
    if user.role.value == "admin":
        collections = ["*"]
    else:
        coll_result = await db.execute(
            select(RoleCollection.collection_name).where(RoleCollection.user_id == user.id)
        )
        collections = [row[0] for row in coll_result.all()]

    return UserContext(
        user_id=str(user.id),
        email=user.email,
        role=user.role.value,
        allowed_collections=collections,
        tenant_id=getattr(user, "tenant_id", "default_tenant") or "default_tenant",
    )


def require_role(*roles: str):
    async def dependency(user: UserContext = Depends(get_current_user)) -> UserContext:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not permitted for this action",
            )
        return user
    return dependency
