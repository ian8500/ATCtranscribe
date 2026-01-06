from app.db import SessionLocal, engine
from app.models import Base, User, AccessLevel
from app.security import hash_password


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == "admin@example.com").first():
            print("Admin already exists")
            return
        admin = User(
            name="Admin",
            email="admin@example.com",
            password_hash=hash_password("admin123"),
            access_level=AccessLevel.admin,
            active=True,
        )
        db.add(admin)
        db.commit()
        print("Created admin user admin@example.com / admin123")
    finally:
        db.close()


if __name__ == "__main__":
    main()
