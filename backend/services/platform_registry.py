# backend/services/platform_registry.py
"""
Platform registry for social media QR code generation.
Add new platforms here — no changes needed elsewhere in the core architecture.
"""
from typing import TypedDict, Optional


class PlatformDef(TypedDict):
    id: str
    name: str
    category: str            # social | video | messaging | professional | music | email_contact
    url_template: str        # e.g. "https://instagram.com/{username}"
    username_prefix: str     # "@" or "" or "+" etc.
    icon_emoji: str
    color: str               # brand hex color
    validation_pattern: Optional[str]  # regex or None


PLATFORMS: dict[str, PlatformDef] = {
    # ── Social ──────────────────────────────────────────────
    "instagram": {
        "id": "instagram", "name": "Instagram", "category": "social",
        "url_template": "https://instagram.com/{username}",
        "username_prefix": "@", "icon_emoji": "📸", "color": "#E1306C",
        "validation_pattern": r"^[\w.]{1,30}$",
    },
    "facebook": {
        "id": "facebook", "name": "Facebook", "category": "social",
        "url_template": "https://facebook.com/{username}",
        "username_prefix": "", "icon_emoji": "👤", "color": "#1877F2",
        "validation_pattern": None,
    },
    "x_twitter": {
        "id": "x_twitter", "name": "X (Twitter)", "category": "social",
        "url_template": "https://x.com/{username}",
        "username_prefix": "@", "icon_emoji": "𝕏", "color": "#000000",
        "validation_pattern": r"^[\w]{1,15}$",
    },
    "threads": {
        "id": "threads", "name": "Threads", "category": "social",
        "url_template": "https://threads.net/@{username}",
        "username_prefix": "@", "icon_emoji": "🧵", "color": "#000000",
        "validation_pattern": None,
    },
    "snapchat": {
        "id": "snapchat", "name": "Snapchat", "category": "social",
        "url_template": "https://snapchat.com/add/{username}",
        "username_prefix": "", "icon_emoji": "👻", "color": "#FFFC00",
        "validation_pattern": None,
    },
    "tiktok": {
        "id": "tiktok", "name": "TikTok", "category": "social",
        "url_template": "https://tiktok.com/@{username}",
        "username_prefix": "@", "icon_emoji": "🎵", "color": "#010101",
        "validation_pattern": None,
    },
    "pinterest": {
        "id": "pinterest", "name": "Pinterest", "category": "social",
        "url_template": "https://pinterest.com/{username}",
        "username_prefix": "", "icon_emoji": "📌", "color": "#E60023",
        "validation_pattern": None,
    },
    "reddit": {
        "id": "reddit", "name": "Reddit", "category": "social",
        "url_template": "https://reddit.com/user/{username}",
        "username_prefix": "u/", "icon_emoji": "🤖", "color": "#FF4500",
        "validation_pattern": None,
    },
    "tumblr": {
        "id": "tumblr", "name": "Tumblr", "category": "social",
        "url_template": "https://{username}.tumblr.com",
        "username_prefix": "", "icon_emoji": "📓", "color": "#35465C",
        "validation_pattern": None,
    },
    # ── Video ────────────────────────────────────────────────
    "youtube_channel": {
        "id": "youtube_channel", "name": "YouTube Channel", "category": "video",
        "url_template": "https://youtube.com/@{username}",
        "username_prefix": "@", "icon_emoji": "▶️", "color": "#FF0000",
        "validation_pattern": None,
    },
    "youtube_video": {
        "id": "youtube_video", "name": "YouTube Video", "category": "video",
        "url_template": "{url}",
        "username_prefix": "", "icon_emoji": "🎬", "color": "#FF0000",
        "validation_pattern": None,
    },
    "youtube_shorts": {
        "id": "youtube_shorts", "name": "YouTube Shorts", "category": "video",
        "url_template": "{url}",
        "username_prefix": "", "icon_emoji": "📱", "color": "#FF0000",
        "validation_pattern": None,
    },
    "twitch": {
        "id": "twitch", "name": "Twitch", "category": "video",
        "url_template": "https://twitch.tv/{username}",
        "username_prefix": "", "icon_emoji": "🎮", "color": "#9146FF",
        "validation_pattern": None,
    },
    "vimeo": {
        "id": "vimeo", "name": "Vimeo", "category": "video",
        "url_template": "https://vimeo.com/{username}",
        "username_prefix": "", "icon_emoji": "🎥", "color": "#1AB7EA",
        "validation_pattern": None,
    },
    "kick": {
        "id": "kick", "name": "Kick", "category": "video",
        "url_template": "https://kick.com/{username}",
        "username_prefix": "", "icon_emoji": "🟢", "color": "#53FC18",
        "validation_pattern": None,
    },
    # ── Messaging ────────────────────────────────────────────
    "whatsapp": {
        "id": "whatsapp", "name": "WhatsApp", "category": "messaging",
        "url_template": "https://wa.me/{username}",
        "username_prefix": "+", "icon_emoji": "💬", "color": "#25D366",
        "validation_pattern": None,
    },
    "telegram": {
        "id": "telegram", "name": "Telegram", "category": "messaging",
        "url_template": "https://t.me/{username}",
        "username_prefix": "@", "icon_emoji": "✈️", "color": "#2CA5E0",
        "validation_pattern": None,
    },
    "messenger": {
        "id": "messenger", "name": "Messenger", "category": "messaging",
        "url_template": "https://m.me/{username}",
        "username_prefix": "", "icon_emoji": "💌", "color": "#0099FF",
        "validation_pattern": None,
    },
    "discord": {
        "id": "discord", "name": "Discord", "category": "messaging",
        "url_template": "https://discord.gg/{username}",
        "username_prefix": "", "icon_emoji": "🎧", "color": "#5865F2",
        "validation_pattern": None,
    },
    "signal": {
        "id": "signal", "name": "Signal", "category": "messaging",
        "url_template": "https://signal.me/#p/{username}",
        "username_prefix": "+", "icon_emoji": "🔒", "color": "#3A76F0",
        "validation_pattern": None,
    },
    "skype": {
        "id": "skype", "name": "Skype", "category": "messaging",
        "url_template": "https://join.skype.com/invite/{username}",
        "username_prefix": "", "icon_emoji": "📞", "color": "#00AFF0",
        "validation_pattern": None,
    },
    "wechat": {
        "id": "wechat", "name": "WeChat", "category": "messaging",
        "url_template": "weixin://dl/chat?{username}",
        "username_prefix": "", "icon_emoji": "💚", "color": "#07C160",
        "validation_pattern": None,
    },
    "viber": {
        "id": "viber", "name": "Viber", "category": "messaging",
        "url_template": "viber://chat?number={username}",
        "username_prefix": "+", "icon_emoji": "📳", "color": "#7360F2",
        "validation_pattern": None,
    },
    # ── Professional ─────────────────────────────────────────
    "linkedin_profile": {
        "id": "linkedin_profile", "name": "LinkedIn Profile", "category": "professional",
        "url_template": "https://linkedin.com/in/{username}",
        "username_prefix": "", "icon_emoji": "💼", "color": "#0A66C2",
        "validation_pattern": None,
    },
    "linkedin_company": {
        "id": "linkedin_company", "name": "LinkedIn Company", "category": "professional",
        "url_template": "https://linkedin.com/company/{username}",
        "username_prefix": "", "icon_emoji": "🏢", "color": "#0A66C2",
        "validation_pattern": None,
    },
    "github": {
        "id": "github", "name": "GitHub", "category": "professional",
        "url_template": "https://github.com/{username}",
        "username_prefix": "@", "icon_emoji": "🐙", "color": "#181717",
        "validation_pattern": None,
    },
    "gitlab": {
        "id": "gitlab", "name": "GitLab", "category": "professional",
        "url_template": "https://gitlab.com/{username}",
        "username_prefix": "@", "icon_emoji": "🦊", "color": "#FC6D26",
        "validation_pattern": None,
    },
    "behance": {
        "id": "behance", "name": "Behance", "category": "professional",
        "url_template": "https://behance.net/{username}",
        "username_prefix": "", "icon_emoji": "🎨", "color": "#1769FF",
        "validation_pattern": None,
    },
    "dribbble": {
        "id": "dribbble", "name": "Dribbble", "category": "professional",
        "url_template": "https://dribbble.com/{username}",
        "username_prefix": "", "icon_emoji": "🏀", "color": "#EA4C89",
        "validation_pattern": None,
    },
    "medium": {
        "id": "medium", "name": "Medium", "category": "professional",
        "url_template": "https://medium.com/@{username}",
        "username_prefix": "@", "icon_emoji": "✍️", "color": "#000000",
        "validation_pattern": None,
    },
    "stackoverflow": {
        "id": "stackoverflow", "name": "Stack Overflow", "category": "professional",
        "url_template": "https://stackoverflow.com/users/{username}",
        "username_prefix": "", "icon_emoji": "📚", "color": "#F58025",
        "validation_pattern": None,
    },
    "portfolio": {
        "id": "portfolio", "name": "Portfolio", "category": "professional",
        "url_template": "{url}",
        "username_prefix": "", "icon_emoji": "🌐", "color": "#6B7280",
        "validation_pattern": None,
    },
    "company_website": {
        "id": "company_website", "name": "Company Website", "category": "professional",
        "url_template": "{url}",
        "username_prefix": "", "icon_emoji": "🏗️", "color": "#374151",
        "validation_pattern": None,
    },
    # ── Email/Contact ────────────────────────────────────────
    "email": {
        "id": "email", "name": "Email", "category": "email_contact",
        "url_template": "mailto:{username}",
        "username_prefix": "", "icon_emoji": "✉️", "color": "#EA4335",
        "validation_pattern": None,
    },
    "email_subject": {
        "id": "email_subject", "name": "Email with Subject", "category": "email_contact",
        "url_template": "mailto:{username}?subject={subject}",
        "username_prefix": "", "icon_emoji": "📧", "color": "#EA4335",
        "validation_pattern": None,
    },
    "email_message": {
        "id": "email_message", "name": "Email with Message", "category": "email_contact",
        "url_template": "mailto:{username}?body={message}",
        "username_prefix": "", "icon_emoji": "📨", "color": "#EA4335",
        "validation_pattern": None,
    },
    "phone": {
        "id": "phone", "name": "Phone", "category": "email_contact",
        "url_template": "tel:{username}",
        "username_prefix": "+", "icon_emoji": "📞", "color": "#22C55E",
        "validation_pattern": None,
    },
    "sms": {
        "id": "sms", "name": "SMS", "category": "email_contact",
        "url_template": "sms:{username}",
        "username_prefix": "+", "icon_emoji": "💬", "color": "#3B82F6",
        "validation_pattern": None,
    },
    "whatsapp_business": {
        "id": "whatsapp_business", "name": "WhatsApp Business", "category": "email_contact",
        "url_template": "https://wa.me/{username}",
        "username_prefix": "+", "icon_emoji": "🟢", "color": "#128C7E",
        "validation_pattern": None,
    },
    "vcard": {
        "id": "vcard", "name": "Business Card", "category": "email_contact",
        "url_template": "{url}",
        "username_prefix": "", "icon_emoji": "👤", "color": "#6B7280",
        "validation_pattern": None,
    },
    # ── Music ────────────────────────────────────────────────
    "spotify": {
        "id": "spotify", "name": "Spotify", "category": "music",
        "url_template": "https://open.spotify.com/user/{username}",
        "username_prefix": "", "icon_emoji": "🎵", "color": "#1DB954",
        "validation_pattern": None,
    },
    "soundcloud": {
        "id": "soundcloud", "name": "SoundCloud", "category": "music",
        "url_template": "https://soundcloud.com/{username}",
        "username_prefix": "", "icon_emoji": "☁️", "color": "#FF5500",
        "validation_pattern": None,
    },
    "apple_music": {
        "id": "apple_music", "name": "Apple Music", "category": "music",
        "url_template": "https://music.apple.com/profile/{username}",
        "username_prefix": "", "icon_emoji": "🍎", "color": "#FC3C44",
        "validation_pattern": None,
    },
    "youtube_music": {
        "id": "youtube_music", "name": "YouTube Music", "category": "music",
        "url_template": "https://music.youtube.com/channel/{username}",
        "username_prefix": "", "icon_emoji": "🎶", "color": "#FF0000",
        "validation_pattern": None,
    },
    "deezer": {
        "id": "deezer", "name": "Deezer", "category": "music",
        "url_template": "https://deezer.com/profile/{username}",
        "username_prefix": "", "icon_emoji": "🎸", "color": "#A238FF",
        "validation_pattern": None,
    },
}


def get_platform(platform_id: str) -> Optional[PlatformDef]:
    return PLATFORMS.get(platform_id)


def list_platforms() -> list[PlatformDef]:
    return list(PLATFORMS.values())


def list_platforms_by_category(category: str) -> list[PlatformDef]:
    return [p for p in PLATFORMS.values() if p["category"] == category]


def build_platform_url(platform_id: str, username: str) -> Optional[str]:
    p = PLATFORMS.get(platform_id)
    if not p:
        return None
    tpl = p["url_template"]
    if "{username}" in tpl:
        return tpl.replace("{username}", username)
    elif "{url}" in tpl:
        # The "username" field holds the full URL for pass-through platforms
        return username
    return tpl
