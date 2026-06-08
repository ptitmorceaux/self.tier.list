from datetime import datetime
from typing import Annotated, Optional

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


PseudoStr = Annotated[str, StringConstraints(min_length=1, strip_whitespace=True)]
UsernameStr = Annotated[str, StringConstraints(min_length=3, strip_whitespace=True)]
PasswordStr = Annotated[str, StringConstraints(min_length=1, strip_whitespace=True)]
PasswordCreateStr = Annotated[str, StringConstraints(min_length=3, strip_whitespace=True)]
JwtExpirMinutes = Annotated[int, Field(ge=1, le=1440)]

class UserCreate(BaseModel):
    pseudo: PseudoStr
    username: UsernameStr
    password: PasswordCreateStr

class UserLogin(BaseModel):
    username: UsernameStr
    password: PasswordStr
    jwt_expir: JwtExpirMinutes  # en minutes, entre 1 et 1440 (1min et 24h)

class UserRead(BaseModel):
    id: int
    pseudo: PseudoStr
    username: UsernameStr
    is_admin: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class UserUpdate(BaseModel):
    password: PasswordStr
    new_pseudo: Optional[PseudoStr] = None
    new_username: Optional[UsernameStr] = None
    new_password: Optional[PasswordStr] = None

class UserDelete(BaseModel):
    password: PasswordStr