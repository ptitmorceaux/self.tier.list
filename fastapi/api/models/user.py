from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, Integer, String, func
from sqlalchemy.orm import relationship
from db.base import Base


class User(Base):
    __tablename__ = "user"
    __table_args__ = (
        CheckConstraint("char_length(username) >= 3", name="ck_user_username_min_length_3"),
        CheckConstraint("char_length(password) >= 3", name="ck_user_password_min_length_3"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    pseudo = Column(String(256), unique=True, nullable=False)
    username = Column(String(256), unique=True, nullable=False)
    password = Column(String(512), nullable=False)
    is_admin = Column(Boolean, nullable=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    tierlists = relationship("Tierlist", back_populates="owner", cascade="all, delete-orphan")
