from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

_client: AsyncIOMotorClient | None = None


def get_db():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.mongodb_url)
    return _client[settings.mongodb_db]


async def ensure_indexes():
    """Create all required MongoDB indexes at application startup."""
    db = get_db()
    await db.social_profiles.create_index("slug", unique=True)
    await db.social_profiles.create_index("user_id")
    await db.dynamic_qrs.create_index("user_id")
    await db.qrcodes.create_index("user_id")
    await db.scans.create_index([("dqr_id", 1), ("ts", -1)])
    await db.logo_cache.create_index("cached_at", expireAfterSeconds=86400)  # 24h TTL
    await db.logo_cache.create_index("domain", unique=True)
