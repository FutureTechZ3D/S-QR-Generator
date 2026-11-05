# backend/models/dynamic.py
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DynamicQRCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    destination_url: str
    expires_at: Optional[datetime] = None
    password: Optional[str] = None       # plaintext input, hashed before storage


class DynamicQRUpdate(BaseModel):
    destination_url: Optional[str] = None
    expires_at: Optional[datetime] = None
    is_active: Optional[bool] = None


class DynamicQR(BaseModel):
    id: str
    user_id: str
    title: str
    destination_url: str
    redirect_url: str                    # /r/:id
    redirect_count: int = 0
    is_active: bool = True
    expires_at: Optional[datetime] = None
    has_password: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
