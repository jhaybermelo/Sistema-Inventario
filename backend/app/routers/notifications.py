import math
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.user import User
from app.models.notification_log import NotificationLog
from app.core.dependencies import require_admin

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notification_logs(
    channel: str | None = None,
    status: str | None = None,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    q = select(NotificationLog)
    if channel:
        q = q.where(NotificationLog.channel == channel)
    if status:
        q = q.where(NotificationLog.status == status)

    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar_one()

    q = q.order_by(NotificationLog.created_at.desc()).offset((page - 1) * size).limit(size)
    result = await db.execute(q)
    items = result.scalars().all()

    return {
        "items": [
            {
                "id": n.id,
                "channel": n.channel,
                "status": n.status,
                "recipient": n.recipient,
                "message": n.message,
                "error": n.error,
                "created_at": n.created_at.isoformat(),
            }
            for n in items
        ],
        "total": total,
        "page": page,
        "pages": max(1, math.ceil(total / size)),
    }


@router.delete("")
async def clear_notification_logs(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    await db.execute(NotificationLog.__table__.delete())
    await db.commit()
    return {"detail": "Historial de notificaciones eliminado"}
