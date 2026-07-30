import hashlib
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.jwt import generate_jwt, jwt_required
from db.session import get_db
from models.user import User
from schemas.user import UserCreate, UserDelete, UserLogin, UserRead, UserUpdate

router = APIRouter(tags=["Users"])

def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

@router.post("/register", response_model=dict, status_code=201)
async def register_user(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    # Vérification uniquement sur le username
    stmt = select(User).where(User.username == payload.username)
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Username already exists")
        
    user = User(
        username=payload.username,
        password=_hash_password(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return {
        "status": 201,
        "data": {"id": user.id, "username": user.username},
        "message": "User created successfully",
    }

@router.post("/login", response_model=dict)
async def login_user(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.username == payload.username)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user or user.password != _hash_password(payload.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
        
    token = generate_jwt({"id": user.id, "username": user.username}, payload.jwt_expir)
    return {
        "status": 200,
        "data": {
            "access_token": token,
            "token_type": "bearer",
            "user": UserRead.model_validate(user).model_dump(),
        },
        "message": "Login successful",
    }

@router.get("/user/me", response_model=dict)
async def read_user(user_jwt=Depends(jwt_required), db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.id == user_jwt["user_id"])
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {
        "status": 200,
        "data": UserRead.model_validate(user).model_dump(),
    }

@router.put("/user/me", response_model=dict)
async def update_user(payload: UserUpdate, user_jwt=Depends(jwt_required), db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.id == user_jwt["user_id"])
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.password != _hash_password(payload.password):
        raise HTTPException(status_code=401, detail="Invalid password")
        
    if payload.new_username and payload.new_username != user.username:
        exists = (await db.execute(select(User).where(User.username == payload.new_username))).scalar_one_or_none()
        if exists:
            raise HTTPException(status_code=409, detail="Username already exists")
        user.username = payload.new_username
        
    if payload.new_password:
        user.password = _hash_password(payload.new_password)
        
    await db.commit()
    await db.refresh(user)
    
    return {
        "status": 200,
        "data": UserRead.model_validate(user).model_dump(),
        "message": "User updated successfully",
    }

@router.delete("/user/me", response_model=dict)
async def delete_user(payload: UserDelete, user_jwt=Depends(jwt_required), db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.id == user_jwt["user_id"])
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.password != _hash_password(payload.password):
        raise HTTPException(status_code=401, detail="Invalid password")
        
    await db.delete(user)
    await db.commit()
    
    return {
        "status": 200,
        "message": "User deleted successfully",
    }