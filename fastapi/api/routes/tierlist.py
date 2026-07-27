import os
from copy import deepcopy
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.jwt import jwt_required
from db.session import get_db
from models.image import Image
from models.image_tierlist import ImageTierlist
from models.tierlist import Tierlist
from models.user import User
from schemas.tierlist import TierlistCreate, TierlistRead, TierlistUpdate

router = APIRouter(tags=["Tierlist"])

def _extract_image_hashes(data: dict) -> set[str]:
    """Extrait tous les hashes d'images présents dans les tiers de la tierlist."""
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
    """Supprime du disque et de la BDD les images qui ne sont plus utilisées nulle part."""
    for img_hash in image_hashes:
        # Compte combien de tierlists utilisent encore cette image
        usage_count = (
            await db.execute(
                select(func.count())
                .select_from(ImageTierlist)
                .where(ImageTierlist.image_hash == img_hash)
            )
        ).scalar_one()

        # Si l'image n'est plus liée à aucune tierlist
        if usage_count == 0:
            image = (
                await db.execute(select(Image).where(Image.hash == img_hash))
            ).scalar_one_or_none()

            if image:
                # 1. Suppression du fichier physique
                if os.path.exists(image.path):
                    try:
                        os.remove(image.path)
                    except OSError:
                        pass
                
                # 2. Suppression de la ligne en BDD
                await db.delete(image)

async def _sync_image_tierlist(db: AsyncSession, tierlist_id: int, data: dict):
    """Met à jour les associations entre la tierlist et ses images."""
    # 1. Supprimer les anciennes associations pour cette tierlist
    await db.execute(
        delete(ImageTierlist).where(ImageTierlist.tierlist_id == tierlist_id)
    )
    
    # 2. Re-créer les associations avec les images actuelles du JSON
    hashes = _extract_image_hashes(data)
    for img_hash in hashes:
        db.add(ImageTierlist(image_hash=img_hash, tierlist_id=tierlist_id))


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
    await db.refresh(tierlist)

    return {"status": 201, "data": TierlistRead.model_validate(tierlist).model_dump()}


@router.get("/tierlist", response_model=dict)
async def list_tierlists(user_jwt=Depends(jwt_required), db: AsyncSession = Depends(get_db)):
    stmt = select(Tierlist).where(
        or_(Tierlist.user_id == user_jwt["user_id"], Tierlist.is_private.is_(False))
    )
    rows = (await db.execute(stmt)).scalars().all()
    return {
        "status": 200,
        "data": [TierlistRead.model_validate(row).model_dump() for row in rows],
    }


@router.get("/tierlist/{tierlist_id}", response_model=dict)
async def get_tierlist(tierlist_id: int, user_jwt=Depends(jwt_required), db: AsyncSession = Depends(get_db)):
    tierlist = (await db.execute(select(Tierlist).where(Tierlist.id == tierlist_id))).scalar_one_or_none()
    if not tierlist:
        raise HTTPException(status_code=404, detail="Tierlist not found")

    if tierlist.is_private and tierlist.user_id != user_jwt["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    return {"status": 200, "data": TierlistRead.model_validate(tierlist).model_dump()}


@router.put("/tierlist/{tierlist_id}", response_model=dict)
async def update_tierlist(
    tierlist_id: int,
    payload: TierlistUpdate,
    user_jwt=Depends(jwt_required),
    db: AsyncSession = Depends(get_db),
):
    tierlist = (await db.execute(select(Tierlist).where(Tierlist.id == tierlist_id))).scalar_one_or_none()
    if not tierlist:
        raise HTTPException(status_code=404, detail="Tierlist not found")

    user = (await db.execute(select(User).where(User.id == user_jwt["user_id"]))).scalar_one_or_none()
    if not user or (tierlist.user_id != user.id and not user.is_admin):
        raise HTTPException(status_code=403, detail="Access denied")

    # 1. On mémorise les images présentement associées à la tierlist
    old_hashes = _extract_image_hashes(tierlist.data) if tierlist.data else set()

    # 2. Mise à jour des champs (nom, description, data JSON, etc.)
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(tierlist, key, value)

    await db.commit()
    await db.refresh(tierlist)

    # 3. Si le JSON 'data' a changé, on re-synchronise les images
    if "data" in updates and updates["data"]:
        new_hashes = _extract_image_hashes(tierlist.data)

        # Mettre à jour la table de jonction image_tierlist
        await _sync_image_tierlist(db, tierlist.id, tierlist.data)
            
        # 🛠️ AJOUT CRUCIAL : Forcer l'application des suppressions/ajouts avant le nettoyage
        await db.flush() 

        # Supprimer physiquement les images qui ont été retirées de cette tierlist
        removed_hashes = old_hashes - new_hashes
        if removed_hashes:
            await _cleanup_orphaned_images(db, removed_hashes)

        await db.commit()

    return {"status": 200, "data": TierlistRead.model_validate(tierlist).model_dump()}


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

    # 1. On récupère la liste des images utilisées par cette tierlist
    used_hashes = _extract_image_hashes(tierlist.data)

    # 2. On supprime la tierlist (grâce à CASCADE, les entrées dans image_tierlist sautent aussi)
    await db.delete(tierlist)
    await db.commit()

    # 3. On nettoie les images qui étaient dans cette tierlist et qui sont devenues orphelines
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
    await db.refresh(duplicated)

    # 🛠️ AJOUT CRUCIAL : Lier les images existantes à cette nouvelle copie
    if duplicated.data:
        await _sync_image_tierlist(db, duplicated.id, duplicated.data)
        await db.commit()

    return {"status": 201, "data": TierlistRead.model_validate(duplicated).model_dump()}