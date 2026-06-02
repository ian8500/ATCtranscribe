import os

from app.db import SessionLocal, ensure_database_ready
from app.models import User, AccessLevel
from app.security import hash_password
from app.settings import get_settings


DEV_ADMIN_EMAIL = "admin@example.com"
DEV_ADMIN_PASSWORD = "admin123"


def main() -> None:
    settings = get_settings()
    ensure_database_ready()

    create_dev_admin = os.getenv("ATC_CREATE_DEV_ADMIN", "false").lower() == "true"
    admin_email = os.getenv("ATC_ADMIN_EMAIL")
    admin_password = os.getenv("ATC_ADMIN_PASSWORD")
    admin_name = os.getenv("ATC_ADMIN_NAME", "Admin")

    if create_dev_admin:
        if settings.is_production:
            raise RuntimeError("ATC_CREATE_DEV_ADMIN cannot be used when APP_ENV=production")
        admin_email = admin_email or DEV_ADMIN_EMAIL
        admin_password = admin_password or DEV_ADMIN_PASSWORD

    if not admin_email or not admin_password:
        print("No admin created.")
        print("For local development: ATC_CREATE_DEV_ADMIN=true python seed.py")
        print("For a real first admin: ATC_ADMIN_EMAIL=you@example.com ATC_ADMIN_PASSWORD='strong-password' python seed.py")
        return

    if settings.is_production and (admin_email == DEV_ADMIN_EMAIL or admin_password == DEV_ADMIN_PASSWORD):
        raise RuntimeError("Refusing to create the development admin in production")

    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == admin_email).first():
            print(f"Admin already exists: {admin_email}")
            return
        admin = User(
            name=admin_name,
            email=admin_email,
            password_hash=hash_password(admin_password),
            access_level=AccessLevel.admin,
            active=True,
        )
        db.add(admin)
        db.commit()
        print(f"Created admin user {admin_email}")
        if create_dev_admin:
            print("Development password: admin123")
    finally:
        db.close()


if __name__ == "__main__":
    main()
