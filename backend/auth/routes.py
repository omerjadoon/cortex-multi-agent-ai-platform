from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

from backend.db.session import get_db
from backend.auth.models import User, UserRole, RoleCollection
from backend.auth.jwt import create_access_token
from backend.auth.rbac import get_current_user, require_role, UserContext

import bcrypt

router = APIRouter(prefix="/auth", tags=["auth"])


def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')[:72]
    return bcrypt.hashpw(pwd_bytes, bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    pwd_bytes = password.encode('utf-8')[:72]
    try:
        return bcrypt.checkpw(pwd_bytes, hashed.encode('utf-8'))
    except Exception:
        return False


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    role: UserRole = UserRole.viewer


class UpdateCollectionsRequest(BaseModel):
    collections: list[str]


class AdminCreateUserRequest(BaseModel):
    email: EmailStr
    password: str
    role: UserRole = UserRole.viewer
    collections: list[str] = []


@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account inactive")

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return {"access_token": token, "token_type": "bearer", "role": user.role.value}


@router.post("/register", status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # First user becomes admin
    count_result = await db.execute(select(User))
    is_first = count_result.scalars().first() is None

    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    role = UserRole.admin if is_first else body.role
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        role=role,
    )
    db.add(user)
    await db.flush()
    await db.commit()
    return {"id": str(user.id), "email": user.email, "role": user.role.value}


@router.get("/me")
async def me(user: UserContext = Depends(get_current_user)):
    return {
        "id": user.user_id,
        "email": user.email,
        "role": user.role,
        "allowed_collections": user.allowed_collections,
    }


@router.get("/users", dependencies=[Depends(require_role("admin"))])
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    users = result.scalars().all()
    return [{"id": str(u.id), "email": u.email, "role": u.role.value, "is_active": u.is_active} for u in users]


@router.post("/users", status_code=201, dependencies=[Depends(require_role("admin"))])
async def admin_create_user(body: AdminCreateUserRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    await db.flush()

    for col in body.collections:
        db.add(RoleCollection(user_id=user.id, role=body.role.value, collection_name=col))

    await db.commit()
    return {"id": str(user.id), "email": user.email, "role": user.role.value}


@router.delete("/users/{user_id}", dependencies=[Depends(require_role("admin"))])
async def admin_delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserContext = Depends(get_current_user),
):
    if str(user_id) == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.delete(user)
    await db.commit()
    return {"detail": f"User {user.email} deleted successfully"}


@router.put("/users/{user_id}/collections", dependencies=[Depends(require_role("admin"))])
async def update_user_collections(
    user_id: UUID,
    body: UpdateCollectionsRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Delete existing mappings
    existing = await db.execute(select(RoleCollection).where(RoleCollection.user_id == user_id))
    for rc in existing.scalars().all():
        await db.delete(rc)

    for col in body.collections:
        db.add(RoleCollection(user_id=user_id, role=user.role.value, collection_name=col))

    await db.commit()
    return {"user_id": str(user_id), "collections": body.collections}
