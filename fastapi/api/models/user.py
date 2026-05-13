from sqlalchemy import Boolean, Column, DateTime, Integer, String, func
from sqlalchemy.orm import relationship
from db.base import Base


class User(Base):
    __tablename__ = "user"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    pseudo = Column(String(256), unique=True, nullable=False)
    username = Column(String(256), unique=True, nullable=False, minlength=3)
    password = Column(String(512), nullable=False, minlength=3)
    is_admin = Column(Boolean, nullable=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    tierlists = relationship("Tierlist", back_populates="owner", cascade="all, delete-orphan")
