import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.models.business_config import BusinessConfig
from app.core.dependencies import require_admin
from app.schemas.config import BusinessConfigUpdate, BusinessConfigResponse, PublicConfigResponse
from app.config import settings

router = APIRouter(prefix="/config", tags=["config"])

MAX_LOGO_BYTES = 2 * 1024 * 1024
ALLOWED_LOGO_TYPES = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}
ALLOWED_LOGO_SIGNATURES = {
    ".png": (bytes.fromhex("89504e470d0a1a0a"),),
    ".jpg": (bytes.fromhex("ffd8ff"),),
    ".webp": (b"RIFF",),
}


async def _get_or_create_config(db: AsyncSession) -> BusinessConfig:
    result = await db.execute(select(BusinessConfig).limit(1))
    config = result.scalar_one_or_none()
    if not config:
        config = BusinessConfig(business_name="Mi Negocio")
        db.add(config)
        await db.flush()
    return config


@router.get("/public", response_model=PublicConfigResponse)
async def get_public_config(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BusinessConfig).limit(1))
    config = result.scalar_one_or_none()
    if not config:
        return PublicConfigResponse(business_name="Mi Negocio", currency_symbol="$")
    logo_url = None
    if config.logo_path:
        logo_url = "/" + config.logo_path.replace("\\", "/")
    return PublicConfigResponse(
        business_name=config.business_name,
        logo_url=logo_url,
        currency_symbol=config.currency_symbol,
    )


@router.get("", response_model=BusinessConfigResponse)
async def get_config(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    return await _get_or_create_config(db)


@router.put("", response_model=BusinessConfigResponse)
async def update_config(
    data: BusinessConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    config = await _get_or_create_config(db)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(config, field, value)
    await db.commit()
    await db.refresh(config)
    return config


@router.post("/logo")
async def upload_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    ext = ALLOWED_LOGO_TYPES.get(file.content_type)
    if ext is None:
        raise HTTPException(status_code=400, detail="Formato no permitido. Usa PNG, JPG o WEBP")
    content = await file.read(MAX_LOGO_BYTES + 1)
    if len(content) > MAX_LOGO_BYTES:
        raise HTTPException(status_code=413, detail="El logo no puede superar 2 MB")
    if not any(content.startswith(sig) for sig in ALLOWED_LOGO_SIGNATURES[ext]):
        raise HTTPException(status_code=400, detail="El contenido no corresponde a una imagen válida")

    upload_dir = settings.UPLOAD_DIR
    os.makedirs(upload_dir, exist_ok=True)
    path = os.path.join(upload_dir, f"logo_{uuid.uuid4().hex}{ext}")
    with open(path, "wb") as f:
        f.write(content)
    config = await _get_or_create_config(db)
    config.logo_path = path
    await db.commit()
    return {"logo_path": path}
