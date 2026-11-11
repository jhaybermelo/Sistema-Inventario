import math
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, asc, desc
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.user import User
from app.models.customer import Customer
from app.models.sale import Sale
from app.core.dependencies import get_current_user
from app.core.logging_config import get_logger
from app.schemas.customer import (
    CustomerCreate, CustomerUpdate,
    CustomerResponse, CustomerListItem, CustomerListResponse,
)
from app.schemas.sale import SaleResponse
from app.config import settings

router = APIRouter(prefix="/customers", tags=["customers"])
logger = get_logger("customers", settings.LOG_DIR)


async def _get_stats(db: AsyncSession, customer_id: int) -> tuple[int, object, object]:
    result = await db.execute(
        select(
            func.count(Sale.id).label("total"),
            func.coalesce(func.sum(Sale.total), 0).label("spent"),
            func.max(Sale.created_at).label("last_at"),
        ).where(Sale.customer_id == customer_id, Sale.status == "completed")
    )
    row = result.one()
    return row.total, row.spent, row.last_at


@router.get("", response_model=CustomerListResponse)
async def list_customers(
    q: str | None = None,
    show_inactive: bool = False,
    sort_by: str = Query(default="name", pattern="^(name|purchases|spent|created_at)$"),
    sort_dir: str = Query(default="asc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # Stats subquery for sorting by purchases/spent
    stats_subq = (
        select(
            Sale.customer_id,
            func.count(Sale.id).label("purchase_count"),
            func.coalesce(func.sum(Sale.total), 0).label("total_spent"),
        )
        .where(Sale.status == "completed")
        .group_by(Sale.customer_id)
        .subquery()
    )

    purchase_col = func.coalesce(stats_subq.c.purchase_count, 0)
    spent_col = func.coalesce(stats_subq.c.total_spent, 0)

    stmt = (
        select(Customer, purchase_col.label("pc"), spent_col.label("ts"))
        .outerjoin(stats_subq, Customer.id == stats_subq.c.customer_id)
    )

    if not show_inactive:
        stmt = stmt.where(Customer.is_active == True)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(
                Customer.full_name.ilike(pattern),
                Customer.phone.ilike(pattern),
                Customer.document_id.ilike(pattern),
                Customer.email.ilike(pattern),
            )
        )

    total_q = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = total_q.scalar_one()

    order_col = {
        "name":       Customer.full_name,
        "created_at": Customer.created_at,
        "purchases":  purchase_col,
        "spent":      spent_col,
    }[sort_by]
    direction = desc if sort_dir == "desc" else asc
    # Secondary sort always by name for stable pagination
    stmt = stmt.order_by(direction(order_col), Customer.full_name)
    stmt = stmt.offset((page - 1) * size).limit(size)

    result = await db.execute(stmt)
    rows = result.all()

    items = [
        CustomerListItem(
            id=row.Customer.id,
            full_name=row.Customer.full_name,
            email=row.Customer.email,
            phone=row.Customer.phone,
            document_id=row.Customer.document_id,
            is_active=row.Customer.is_active,
            created_at=row.Customer.created_at,
            total_purchases=int(row.pc),
            total_spent=row.ts,
        )
        for row in rows
    ]

    return CustomerListResponse(
        items=items,
        total=total,
        page=page,
        pages=max(1, math.ceil(total / size)),
    )


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    data: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.email:
        existing = await db.execute(select(Customer).where(Customer.email == data.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Ya existe un cliente con ese email")
    if data.document_id:
        existing = await db.execute(select(Customer).where(Customer.document_id == data.document_id))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Ya existe un cliente con ese número de documento")

    customer = Customer(**data.model_dump(exclude_none=False))
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    logger.info("[CUSTOMER_CREATED] id=%s name=%r by=%s", customer.id, customer.full_name, current_user.username)
    return CustomerResponse(
        **{k: getattr(customer, k) for k in CustomerResponse.model_fields if k not in ('total_purchases', 'total_spent', 'last_purchase_at')},
        total_purchases=0, total_spent=0, last_purchase_at=None,
    )


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    total, spent, last_at = await _get_stats(db, customer_id)
    return CustomerResponse(
        **{k: getattr(customer, k) for k in CustomerResponse.model_fields if k not in ('total_purchases', 'total_spent', 'last_purchase_at')},
        total_purchases=total,
        total_spent=spent,
        last_purchase_at=last_at,
    )


@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: int,
    data: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    updates = data.model_dump(exclude_unset=True)
    if "email" in updates and updates["email"]:
        existing = await db.execute(
            select(Customer).where(Customer.email == updates["email"], Customer.id != customer_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Ya existe un cliente con ese email")
    if "document_id" in updates and updates["document_id"]:
        existing = await db.execute(
            select(Customer).where(Customer.document_id == updates["document_id"], Customer.id != customer_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Ya existe un cliente con ese número de documento")

    for field, value in updates.items():
        setattr(customer, field, value)

    await db.commit()
    await db.refresh(customer)
    logger.info("[CUSTOMER_UPDATED] id=%s fields=%s by=%s", customer_id, list(updates.keys()), current_user.username)

    total, spent, last_at = await _get_stats(db, customer_id)
    return CustomerResponse(
        **{k: getattr(customer, k) for k in CustomerResponse.model_fields if k not in ('total_purchases', 'total_spent', 'last_purchase_at')},
        total_purchases=total,
        total_spent=spent,
        last_purchase_at=last_at,
    )


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    customer.is_active = False
    await db.commit()
    logger.info("[CUSTOMER_DEACTIVATED] id=%s name=%r by=%s", customer_id, customer.full_name, current_user.username)


@router.get("/{customer_id}/sales")
async def get_customer_sales(
    customer_id: int,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    total_q = await db.execute(
        select(func.count()).where(Sale.customer_id == customer_id)
    )
    total = total_q.scalar_one()

    sales_q = await db.execute(
        select(Sale)
        .options(selectinload(Sale.items), selectinload(Sale.customer))
        .where(Sale.customer_id == customer_id)
        .order_by(Sale.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    sales = sales_q.scalars().all()

    return {
        "items": [SaleResponse.model_validate(s) for s in sales],
        "total": total,
        "page": page,
        "pages": max(1, math.ceil(total / size)),
    }
