from fastapi import Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, UserRole

def get_current_user(db: Session = Depends(get_db)) -> User:
    # Try to get a test user with a known ID or create it if not exists
    test_user_id = 1
    user = db.query(User).filter(User.id == test_user_id).first()
    if not user:
        user = User(
            id=test_user_id,
            username="testuser",
            email="testuser@example.com",
            password_hash="fakehashedpassword",
            role=UserRole.USER,
            is_active=True,
            display_name="Test User"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user
