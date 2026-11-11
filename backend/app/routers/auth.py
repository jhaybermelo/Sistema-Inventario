from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.core.security import verify_password, create_access_token
from app.core.dependencies import get_current_user
from app.core.logging_config import get_logger
from app.core.rate_limit import login_limiter
from app.schemas.auth import LoginRequest, TokenResponse, UserMe
from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])
logger = get_logger("auth", settings.LOG_DIR)


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    limiter_key = f"{client_ip}:{data.username.lower()}"
    try:
        login_limiter.check(limiter_key)
    except HTTPException:
        logger.warning("[LOGIN_BLOCKED] username=%s ip=%s reason=rate_limited", data.username, client_ip)
        raise

    result = await db.execute(
        select(User).where(User.username == data.username)
    )
    user = result.scalar_one_or_none()

    if not user:
        logger.warning("[LOGIN_FAIL] username=%s reason=user_not_found", data.username)
        login_limiter.register_failure(limiter_key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario o contraseña incorrectos")

    if not user.is_active:
        logger.warning("[LOGIN_FAIL] username=%s reason=account_inactive", data.username)
        login_limiter.register_failure(limiter_key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario o contraseña incorrectos")

    if not verify_password(data.password, user.hashed_password):
        logger.warning("[LOGIN_FAIL] username=%s reason=wrong_password", data.username)
        login_limiter.register_failure(limiter_key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario o contraseña incorrectos")

    login_limiter.reset(limiter_key)
    token = create_access_token({"sub": str(user.id), "role": user.role})
    logger.info("[LOGIN_OK] username=%s role=%s", user.username, user.role)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserMe)
async def me(current_user: User = Depends(get_current_user)):
    return current_user
