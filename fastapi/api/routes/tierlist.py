import os
from copy import deepcopy

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.jwt import jwt_required, verify_jwt
from db.session import get_db
from models.image import Image
from models.image_tierlist import ImageTierlist
from models.tierlist import Tierlist
from models.user import User
from schemas.tierlist import TierlistCreate, TierlistRead, TierlistUpdate

router = APIRouter(tags=["Tierlist"])

def _extract_image_hashes(data: dict) -> set[str]:
    hashes = set()
    tiers = data.get("tiers", [])
    for tier in tiers:
        for item in tier.get("items", []):
            if "image_hash" in item and item["image_hash"]:
                hashes.add(item["image_hash"])
    return hashes

def _flatten_to_blank(data: dict) -> dict:
    normalized = deepcopy(data)
    tiers = normalized.get("tiers", [])
    items = []
    for tier in tiers:
        items.extend(tier.get("items", []))
    normalized["tiers"] = [{"id": 0, "name": "_blank", "color": "#FFFFFF", "items": items}]
    normalized["order"] = [0]
    return normalized

async def _cleanup_orphaned_images(db: AsyncSession, image_hashes: set[str]):
    for img_hash in image_hashes:
        usage_count = (
            await db.execute(
                select(func.count())
                .select_from(ImageTierlist)
                .where(ImageTierlist.image_hash == img_hash)
            )
        ).scalar_one()
        if usage_count == 0:
            image = (
                await db.execute(select(Image).where(Image.hash == img_hash))
            ).scalar_one_or_none()
            if image:
                if os.path.exists(image.path):
                    try:
                        os.remove(image.path)
                    except OSError:
                        pass
                await db.delete(image)

async def _sync_image_tierlist(db: AsyncSession, tierlist_id: int, data: dict):
    await db.execute(
        delete(ImageTierlist).where(ImageTierlist.tierlist_id == tierlist_id)
    )
    hashes = _extract_image_hashes(data)
    for img_hash in hashes:
        db.add(ImageTierlist(image_hash=img_hash, tierlist_id=tierlist_id))

def _format_tierlist_response(tierlist: Tierlist) -> dict:
    data = TierlistRead.model_validate(tierlist).model_dump()
    if hasattr(tierlist, "owner") and tierlist.owner:
        data["user_pseudo"] = tierlist.owner.pseudo
    else:
        data["user_pseudo"] = "Inconnu"
    return data

@router.post("/tierlist", response_model=dict, status_code=201)
async def create_tierlist(payload: TierlistCreate, user_jwt=Depends(jwt_required), db: AsyncSession = Depends(get_db)):
    if payload.user_id != user_jwt["user_id"]:
        raise HTTPException(status_code=403, detail="Cannot create tierlist for another user")
    tierlist = Tierlist(
        user_id=payload.user_id,
        name=payload.name,
        description=payload.description,
        data=payload.data,
        is_private=payload.is_private,
    )
    db.add(tierlist)
    await db.commit()
    
    stmt = select(Tierlist).options(selectinload(Tierlist.owner)).where(Tierlist.id == tierlist.id)
    tierlist_with_owner = (await db.execute(stmt)).scalar_one()

    return {"status": 201, "data": _format_tierlist_response(tierlist_with_owner)}

@router.get("/tierlist", response_model=dict)
async def list_tierlists(request: Request, db: AsyncSession = Depends(get_db)): # 👈 Authentification optionnelle
    # On vérifie manuellement si un token valide a été fourni
    auth = request.headers.get("Authorization")
    user_id = None
    if auth and auth.startswith("Bearer "):
        token = auth.split(" ")[1]
        payload = verify_jwt(token)
        if payload:
            user_id = int(payload["sub"])

    # Si l'utilisateur est connecté, il voit le public + son privé
    if user_id:
        stmt = select(Tierlist).options(selectinload(Tierlist.owner)).where(
            or_(Tierlist.user_id == user_id, Tierlist.is_private.is_(False))
        )
    # S'il n'est pas connecté (visiteur), il ne voit QUE le public
    else:
        stmt = select(Tierlist).options(selectinload(Tierlist.owner)).where(
            Tierlist.is_private.is_(False)
        )

    rows = (await db.execute(stmt)).scalars().all()
    return {
        "status": 200,
        "data": [_format_tierlist_response(row) for row in rows],
    }

@router.get("/tierlist/{tierlist_id}", response_model=dict)
async def get_tierlist(tierlist_id: int, request: Request, db: AsyncSession = Depends(get_db)): # 👈 Authentification optionnelle
    stmt = select(Tierlist).options(selectinload(Tierlist.owner)).where(Tierlist.id == tierlist_id)
    tierlist = (await db.execute(stmt)).scalar_one_or_none()
    if not tierlist:
        raise HTTPException(status_code=404, detail="Tierlist not found")
    
    # On récupère le user_id de la même manière pour le contrôle d'accès
    auth = request.headers.get("Authorization")
    user_id = None
    if auth and auth.startswith("Bearer "):
        token = auth.split(" ")[1]
        payload = verify_jwt(token)
        if payload:
            user_id = int(payload["sub"])

    # On bloque si la tierlist est privée et que ce n'est pas le proprio
    if tierlist.is_private and tierlist.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
        
    return {"status": 200, "data": _format_tierlist_response(tierlist)}

@router.put("/tierlist/{tierlist_id}", response_model=dict)
async def update_tierlist(
    tierlist_id: int,
    payload: TierlistUpdate,
    user_jwt=Depends(jwt_required),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Tierlist).options(selectinload(Tierlist.owner)).where(Tierlist.id == tierlist_id)
    tierlist = (await db.execute(stmt)).scalar_one_or_none()
    if not tierlist:
        raise HTTPException(status_code=404, detail="Tierlist not found")
    user = (await db.execute(select(User).where(User.id == user_jwt["user_id"]))).scalar_one_or_none()
    if not user or (tierlist.user_id != user.id and not user.is_admin):
        raise HTTPException(status_code=403, detail="Access denied")

    old_hashes = _extract_image_hashes(tierlist.data) if tierlist.data else set()

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(tierlist, key, value)
    await db.commit()

    if "data" in updates and updates["data"]:
        new_hashes = _extract_image_hashes(tierlist.data)
        await _sync_image_tierlist(db, tierlist.id, tierlist.data)
        await db.flush()
        removed_hashes = old_hashes - new_hashes
        if removed_hashes:
            await _cleanup_orphaned_images(db, removed_hashes)
        await db.commit()
        
    return {"status": 200, "data": _format_tierlist_response(tierlist)}

@router.delete("/tierlist/{tierlist_id}", response_model=dict)
async def delete_tierlist(
    tierlist_id: int,
    user_jwt=Depends(jwt_required),
    db: AsyncSession = Depends(get_db)
):
    tierlist = (await db.execute(select(Tierlist).where(Tierlist.id == tierlist_id))).scalar_one_or_none()
    if not tierlist:
        raise HTTPException(status_code=404, detail="Tierlist not found")
    user = (await db.execute(select(User).where(User.id == user_jwt["user_id"]))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if tierlist.user_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")

    used_hashes = _extract_image_hashes(tierlist.data)
    await db.delete(tierlist)
    await db.commit()
    await _cleanup_orphaned_images(db, used_hashes)
    await db.commit()

    return {"status": 200, "message": "Tierlist and orphaned images deleted successfully"}

@router.post("/tierlist/duplicate/{tierlist_id}", response_model=dict, status_code=201)
async def duplicate_tierlist(
    tierlist_id: int,
    maintain_order: int = Query(default=1, ge=0, le=1),
    user_jwt=Depends(jwt_required),
    db: AsyncSession = Depends(get_db),
):
    source = (await db.execute(select(Tierlist).where(Tierlist.id == tierlist_id))).scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Tierlist not found")
    if source.is_private and source.user_id != user_jwt["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    data = deepcopy(source.data)
    if maintain_order == 0:
        data = _flatten_to_blank(data)

    duplicated = Tierlist(
        user_id=user_jwt["user_id"],
        name=f"{source.name} (copy)",
        description=source.description,
        data=data,
        is_private=True,
    )
    db.add(duplicated)
    await db.commit()

    if duplicated.data:
        await _sync_image_tierlist(db, duplicated.id, duplicated.data)
        await db.commit()

    stmt = select(Tierlist).options(selectinload(Tierlist.owner)).where(Tierlist.id == duplicated.id)
    dup_with_owner = (await db.execute(stmt)).scalar_one()

    return {"status": 201, "data": _format_tierlist_response(dup_with_owner)}