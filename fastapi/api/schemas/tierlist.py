from datetime import datetime
from typing import Annotated, Any, Optional

from pydantic import BaseModel, ConfigDict, StringConstraints


NameStr = Annotated[str, StringConstraints(min_length=1, strip_whitespace=True)]
DescriptionStr = Annotated[str, StringConstraints(strip_whitespace=True)]


class TierlistBase(BaseModel):
    name: NameStr
    description: Optional[DescriptionStr] = None
    data: dict[str, Any]
    is_private: bool = False

class TierlistCreate(TierlistBase):
    user_id: int

class TierlistRead(TierlistBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    user_pseudo: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class TierlistUpdate(BaseModel):
    name: Optional[NameStr] = None
    description: Optional[DescriptionStr] = None
    data: Optional[dict[str, Any]] = None
    is_private: Optional[bool] = None

class TierlistDelete(BaseModel):
    id: int