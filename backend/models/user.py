from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    email: EmailStr
    password: str = Field(min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class User(BaseModel):
    id: str
    name: str
    email: str
    plan: str = "free"          # free | pro | business
    qr_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    plan: str
    qr_count: int
    created_at: datetime
