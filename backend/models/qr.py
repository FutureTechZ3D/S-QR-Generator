from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, Any
from datetime import datetime
from enum import Enum


class QRType(str, Enum):
    URL            = "url"
    TEXT           = "text"
    EMAIL          = "email"
    PHONE          = "phone"
    SMS            = "sms"
    WIFI           = "wifi"
    VCARD          = "vcard"
    LOCATION       = "location"
    YOUTUBE        = "youtube"
    PDF            = "pdf"
    IMAGE          = "image"
    APP_STORE      = "app_store"
    MENU           = "menu"
    SOCIAL         = "social"
    SOCIAL_PROFILE = "social_profile"
    DYNAMIC        = "dynamic"


class QRStyle(BaseModel):
    foreground:    str = "#000000"
    background:    str = "#FFFFFF"
    error_correct: str = "H"           # L M Q H
    box_size:      int = 10
    border:        int = 4
    logo_url:      Optional[str] = None
    # Extended style fields:
    corner_style:  str = "square"      # square | rounded | extra_rounded
    fg_color_2:    Optional[str] = None  # gradient second color
    logo_b64:      Optional[str] = None  # base64-encoded uploaded logo
    logo_size:     float = 0.25          # fraction of QR dimension (0.2–0.35)
    logo_padding:  bool = True           # draw white circle behind logo
    platform_id:   Optional[str] = None  # for platform auto-logo (future)


class QRCreate(BaseModel):
    title:    str = Field(min_length=1, max_length=120)
    qr_type:  QRType = QRType.URL
    content:  str    = Field(min_length=1)
    style:    QRStyle = Field(default_factory=QRStyle)


class QRCode(BaseModel):
    id:          str
    user_id:     Optional[str] = None
    title:       str
    qr_type:     QRType
    content:     str
    style:       QRStyle
    image_path:  Optional[str] = None   # saved PNG path
    image_b64:   Optional[str] = None   # base64 PNG for immediate display
    scans:       int = 0
    created_at:  datetime = Field(default_factory=datetime.utcnow)
    updated_at:  datetime = Field(default_factory=datetime.utcnow)
