import math
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date
from app.database import get_db
from app.models.user import User
from app.core.dependencies import get_current_user, require_admin
from app.repositories.sale_repository import SaleRepository
from app.services.sale_service import SaleService
from app.schemas.sale import SaleCreate, SaleResponse, SaleListResponse

router = APIRouter(prefix="/sales", tags=["sales"])


@router.post("", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
async def create_sale(
    data: SaleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SaleService(db)
    sale = await service.create_sale(data, current_user.id)
    repo = SaleRepository(db)
    return await repo.get_by_id(sale.id)


@router.get("", response_model=SaleListResponse)
async def list_sales(
    date_from: date | None = None,
    date_to: date | None = None,
    payment_method: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    sale_number: str | None = None,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    repo = SaleRepository(db)
    sales, total = await repo.get_list(date_from, date_to, payment_method, status_filter, sale_number, page, size)
    pages = math.ceil(total / size) if total else 1
    return SaleListResponse(items=sales, total=total, page=page, size=size, pages=pages)


@router.get("/{sale_id}", response_model=SaleResponse)
async def get_sale(sale_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    repo = SaleRepository(db)
    sale = await repo.get_by_id(sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return sale


@router.post("/{sale_id}/cancel", response_model=SaleResponse)
async def cancel_sale(
    sale_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    service = SaleService(db)
    return await service.cancel_sale(sale_id, cancelled_by=current_user.id)
