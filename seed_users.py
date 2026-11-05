"""
Seed test pro users. Run: python seed_users.py
from D:\\AI-Projects\\AI-Products\\QRGenerator
"""
import asyncio
import sys
import uuid
from datetime import datetime
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

async def seed():
    from backend.core.database import get_db, ensure_indexes
    from backend.core.security import hash_password

    await ensure_indexes()
    db = get_db()

    test_users = [
        {"name": "Sanjay", "email": "sanjay@example.com", "password": "password12345", "plan": "pro"},
        {"name": "Rithesh", "email": "rithesh@example.com", "password": "password12345", "plan": "pro"},
        {"name": "AJ", "email": "aj@example.com", "password": "password12345", "plan": "pro"},
    ]

    for u in test_users:
        existing = await db.users.find_one({"email": u["email"]})
        if existing:
            # Update plan to pro if already exists
            await db.users.update_one({"email": u["email"]}, {"$set": {"plan": "pro"}})
            print(f"Updated {u['email']} plan to pro")
        else:
            user_doc = {
                "_id": str(uuid.uuid4()),
                "name": u["name"],
                "email": u["email"],
                "password": hash_password(u["password"]),
                "plan": u["plan"],
                "qr_count": 0,
                "created_at": datetime.utcnow(),
            }
            await db.users.insert_one(user_doc)
            print(f"Created {u['email']} with plan={u['plan']}")

    print("Seeding complete.")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    asyncio.run(seed())
