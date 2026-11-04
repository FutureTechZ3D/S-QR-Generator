import uuid
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from ..models.user import UserCreate, UserLogin, UserOut
from ..core.database import get_db
from ..core.security import (
    hash_password, verify_password,
    create_access_token, get_current_user
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=dict)
async def register(data: UserCreate):
    db = get_db()
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(400, "Email already registered")

    user_id = str(uuid.uuid4())
    user_doc = {
        "_id":        user_id,
        "name":       data.name,
        "email":      data.email,
        "password":   hash_password(data.password),
        "plan":       "free",
        "qr_count":   0,
        "created_at": datetime.utcnow(),
    }
    await db.users.insert_one(user_doc)

    token = create_access_token({"sub": user_id})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id":    user_id,
            "name":  data.name,
            "email": data.email,
            "plan":  "free",
        },
    }


@router.post("/login", response_model=dict)
async def login(data: UserLogin):
    db = get_db()
    user = await db.users.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(401, "Invalid email or password")

    token = create_access_token({"sub": user["_id"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id":    user["_id"],
            "name":  user["name"],
            "email": user["email"],
            "plan":  user.get("plan", "free"),
        },
    }


@router.get("/me")
async def me(current_user=Depends(get_current_user)):
    return {
        "id":        current_user["_id"],
        "name":      current_user["name"],
        "email":     current_user["email"],
        "plan":      current_user.get("plan", "free"),
        "qr_count":  current_user.get("qr_count", 0),
    }
