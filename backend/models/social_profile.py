# backend/models/social_profile.py
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class SocialLink(BaseModel):
    platform_id: str
    url: str
    title: Optional[str] = None          # override display title


class SocialProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    username: str = Field(min_length=1, max_length=50)
    bio: Optional[str] = Field(default=None, max_length=300)
    avatar_url: Optional[str] = None
    theme_color: str = "#1D59F9"
    bg_color: str = "#FFFFFF"
    links: List[SocialLink] = Field(default_factory=list)


class SocialProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=80)
    username: Optional[str] = Field(default=None, max_length=50)
    bio: Optional[str] = Field(default=None, max_length=300)
    avatar_url: Optional[str] = None
    theme_color: Optional[str] = None
    bg_color: Optional[str] = None
    links: Optional[List[SocialLink]] = None


class SocialProfile(BaseModel):
    id: str
    user_id: str
    name: str
    username: str
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    theme_color: str = "#1D59F9"
    bg_color: str = "#FFFFFF"
    links: List[SocialLink] = Field(default_factory=list)
    visits: int = 0
    slug: str                            # URL-safe unique slug, used in /p/:slug
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
