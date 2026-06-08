import hashlib
import os
from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse
from PIL import Image as PILImage, ImageOps
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.jwt import jwt_required
from db.session import get_db
from models.image import Image
from models.image_tierlist import ImageTierlist
from schemas.image import ImageDeleteResponse, ImageUploadResponse

router = APIRouter(tags=["Image"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/uploads")
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", 5 * 1024 * 1024))  # 5 MB
NORMALIZED_IMAGE_SIZE = int(os.getenv("NORMALIZED_IMAGE_SIZE", 256))


@router.post("/upload", response_model=ImageUploadResponse, status_code=201)
async def upload_image(
    response: Response,
    file: UploadFile = File(...),
    user_jwt=Depends(jwt_required),
    db: AsyncSession = Depends(get_db),
):
    del user_jwt

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Unsupported file type")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 5 MB)")

    try:
        source = PILImage.open(BytesIO(raw)).convert("RGBA")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid image payload") from exc

    normalized = ImageOps.fit(
        source,
        (NORMALIZED_IMAGE_SIZE, NORMALIZED_IMAGE_SIZE),
        method=PILImage.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )
    image_hash = hashlib.sha256(normalized.tobytes()).hexdigest()

    existing = (await db.execute(select(Image).where(Image.hash == image_hash))).scalar_one_or_none()
    if existing:
        response.status_code = 200
        return {"status": 200, "data": {"hash": image_hash, "created": False}}

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(UPLOAD_DIR, f"{image_hash}.webp")
    normalized.save(file_path, format="WEBP")

    image = Image(hash=image_hash, path=file_path)
    db.add(image)
    await db.commit()

    return {"status": 201, "data": {"hash": image_hash, "created": True}}


@router.get("/image/{image_hash}")
async def read_image(image_hash: str, db: AsyncSession = Depends(get_db)):
    image = (await db.execute(select(Image).where(Image.hash == image_hash))).scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    if not os.path.exists(image.path):
        raise HTTPException(status_code=404, detail="Image file not found on disk")

    return FileResponse(image.path, media_type="image/webp")


@router.delete("/image/{image_hash}", response_model=ImageDeleteResponse)
async def delete_image(
    image_hash: str,
    user_jwt=Depends(jwt_required),
    db: AsyncSession = Depends(get_db),
):
    del user_jwt

    image = (await db.execute(select(Image).where(Image.hash == image_hash))).scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    usage_count = (
        await db.execute(
            select(func.count()).select_from(ImageTierlist).where(ImageTierlist.image_hash == image_hash)
        )
    ).scalar_one()

    if usage_count > 0:
        raise HTTPException(status_code=409, detail="Image still used by tierlists")

    await db.delete(image)
    await db.commit()

    if os.path.exists(image.path):
        os.remove(image.path)

    return {"status": 200, "message": "Image deleted successfully"}
