"""
Platform auto-detection from a URL.
Matches URLs against known platform domains using regex.
"""
import re
from typing import Optional
from .platform_registry import get_platform


# Ordered list of (regex_pattern, platform_id) tuples.
# More specific patterns must come before generic ones.
DETECTION_RULES: list[tuple[str, str]] = [
    # Video
    (r"(?:youtube\.com/shorts/|youtu\.be/\S+shorts)", "youtube_shorts"),
    (r"youtube\.com|youtu\.be", "youtube_channel"),
    (r"twitch\.tv", "twitch"),
    (r"vimeo\.com", "vimeo"),
    # Social
    (r"instagram\.com", "instagram"),
    (r"(?:facebook\.com|fb\.com)", "facebook"),
    (r"(?:twitter\.com|x\.com)", "x_twitter"),
    (r"threads\.net", "threads"),
    (r"tiktok\.com", "tiktok"),
    (r"snapchat\.com", "snapchat"),
    (r"pinterest\.com", "pinterest"),
    (r"reddit\.com", "reddit"),
    # Messaging
    (r"(?:wa\.me|whatsapp\.com)", "whatsapp"),
    (r"(?:t\.me|telegram\.org)", "telegram"),
    (r"(?:m\.me|messenger\.com)", "messenger"),
    (r"(?:discord\.gg|discord\.com)", "discord"),
    (r"signal\.me", "signal"),
    # Professional
    (r"linkedin\.com/company", "linkedin_company"),
    (r"linkedin\.com", "linkedin_profile"),
    (r"github\.com", "github"),
    (r"gitlab\.com", "gitlab"),
    (r"behance\.net", "behance"),
    (r"dribbble\.com", "dribbble"),
    (r"medium\.com", "medium"),
    # Music
    (r"open\.spotify\.com", "spotify"),
    (r"soundcloud\.com", "soundcloud"),
    (r"music\.apple\.com", "apple_music"),
]


def detect_platform(url: str) -> Optional[dict]:
    """
    Detect which platform a URL belongs to.
    Returns the platform dict from the registry, or None if no match.
    Adds a 'suggested_theme' key equal to the platform_id.
    """
    if not url:
        return None

    url_lower = url.lower()

    for pattern, platform_id in DETECTION_RULES:
        if re.search(pattern, url_lower):
            platform = get_platform(platform_id)
            if platform:
                return {**platform, "suggested_theme": platform_id}
            # Platform id found in rules but not in registry — return minimal info
            return {
                "id": platform_id,
                "platform_id": platform_id,
                "name": platform_id.replace("_", " ").title(),
                "suggested_theme": platform_id,
                "icon_emoji": "🌐",
                "color": "#1D59F9",
            }

    return None
