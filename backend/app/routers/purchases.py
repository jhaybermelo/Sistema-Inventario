import math
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from datetime import date, datetime, timedelta
from typing import Optional
from app.database import get_db
from app.models.purchase import Purchase, PurchaseItem
from app.models.product import Product
from app.models.user import User
from app.core.dependencies import get_current_user, require_admin
from app.schemas.purchase import PurchaseCreate, PurchaseResponse, PurchaseListResponse

router = APIRouter(prefix="/purchases", tags=["purchases"])


async def _generate_number(db: AsyncSession) -> str:
    today = date.today().strftime("%Y%m%d")
    prefix = f"COMP-{today}-"
    result = await db.execute(
        select(func.count(Purchase.id)).where(Purchase.purchase_number.like(f"{prefix}%"))
    )
    count = result.scalar_one()
    return f"{prefix}{count + 1:04d}"


async def _load(db: AsyncSession, purchase_id: int) -> Optional[Purchase]:
    result = await db.execute(
        select(Purchase).options(selectinload(Purchase.items)).where(Purchase.id == purchase_id)
    )
    return result.scalar_one_or_none()


@router.post("", response_model=PurchaseResponse, status_code=201)
async def create_purchase(
    data: PurchaseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product_ids = [item.product_id for item in data.items]
    result = await db.execute(select(Product).where(Product.id.in_(product_ids)))
    products = {p.id: p for p in result.scalars().all()}

    missing = [pid for pid in product_ids if pid not in products]
    if missing:
        raise HTTPException(400, f"Producto(s) no encontrado(s): {missing}")

    total = sum(item.quantity * item.unit_cost for item in data.items)

    purchase = Purchase(
        purchase_number=await _generate_number(db),
        supplier_name=data.supplier_name.strip() if data.supplier_name else None,
        user_id=current_user.id,
        total=total,
        status="confirmed",
        notes=data.notes,
    )
    db.add(purchase)
    await db.flush()

    for item_data in data.items:
        product = products[item_data.product_id]
        db.add(PurchaseItem(
            purchase_id=purchase.id,
            product_id=product.id,
            product_name=product.name,
            product_sku=product.sku,
            quantity=item_data.quantity,
            unit_cost=item_data.unit_cost,
            line_total=item_data.quantity * item_data.unit_cost,
        ))
        product.quantity += item_data.quantity
        if data.update_costs and item_data.unit_cost > 0:
            product.cost = item_data.unit_cost

    await db.commit()
    return await _load(db, purchase.id)


@router.get("", response_model=PurchaseListResponse)
async def list_purchases(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=10, ge=1, le=100),
    supplier_name: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    base_filters = []
    if supplier_name:
        base_filters.append(Purchase.supplier_name.ilike(f"%{supplier_name}%"))
    if date_from:
        base_filters.append(
            Purchase.created_at >= datetime(date_from.year, date_from.month, date_from.day)
        )
    if date_to:
        end = datetime(date_to.year, date_to.month, date_to.day) + timedelta(days=1)
        base_filters.append(Purchase.created_at < end)

    count_stmt = select(func.count(Purchase.id))
    if base_filters:
        count_stmt = count_stmt.where(*base_filters)
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = (
        select(Purchase)
        .options(selectinload(Purchase.items))
        .order_by(desc(Purchase.created_at))
        .offset((page - 1) * size)
        .limit(size)
    )
    if base_filters:
        stmt = stmt.where(*base_filters)

    purchases = list((await db.execute(stmt)).scalars().all())

    return PurchaseListResponse(
        items=purchases,
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total else 1,
    )


@router.get("/{purchase_id}", response_model=PurchaseResponse)
async def get_purchase(
    purchase_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    purchase = await _load(db, purchase_id)
    if not purchase:
        raise HTTPException(404, "Compra no encontrada")
    return purchase


@router.post("/{purchase_id}/cancel", response_model=PurchaseResponse)
async def cancel_purchase(
    purchase_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    purchase = await _load(db, purchase_id)
    if not purchase:
        raise HTTPException(404, "Compra no encontrada")
    if purchase.status == "cancelled":
        raise HTTPException(400, "La compra ya está cancelada")

    product_ids = [item.product_id for item in purchase.items]
    result = await db.execute(select(Product).where(Product.id.in_(product_ids)))
    products = {p.id: p for p in result.scalars().all()}

    for item in purchase.items:
        if item.product_id in products:
            products[item.product_id].quantity = max(
                0, products[item.product_id].quantity - item.quantity
            )

    purchase.status = "cancelled"
    await db.commit()
    return await _load(db, purchase.id)
