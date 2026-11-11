import math
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from decimal import Decimal
from app.database import get_db
from app.models.user import User
from app.models.customer import Customer
from app.models.customer_credit import CustomerCredit, CreditPayment
from app.models.sale import Sale
from app.core.dependencies import get_current_user
from app.core.logging_config import get_logger
from app.schemas.credit import CreditPaymentCreate, CustomerCreditResponse, CustomerCreditSummary
from app.config import settings

router = APIRouter(tags=["credits"])
logger = get_logger("credits", settings.LOG_DIR)


def _build_credit_response(c: CustomerCredit) -> CustomerCreditResponse:
    return CustomerCreditResponse(
        id=c.id,
        customer_id=c.customer_id,
        sale_id=c.sale_id,
        sale_number=c.sale.sale_number if c.sale else "",
        original_amount=c.original_amount,
        paid_amount=c.paid_amount,
        balance=c.balance,
        status=c.status,
        notes=c.notes,
        created_at=c.created_at,
        payments=[p for p in c.payments],
    )


# ── Per-customer credits ───────────────────────────────────────────────────────

@router.get("/customers/{customer_id}/credits", response_model=CustomerCreditSummary)
async def get_customer_credits(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    credits_q = await db.execute(
        select(CustomerCredit)
        .options(
            selectinload(CustomerCredit.payments),
            selectinload(CustomerCredit.sale),
        )
        .where(CustomerCredit.customer_id == customer_id)
        .order_by(CustomerCredit.created_at.desc())
    )
    credits = credits_q.scalars().all()

    total_credit = sum(c.original_amount for c in credits)
    total_paid = sum(c.paid_amount for c in credits)
    total_balance = total_credit - total_paid

    return CustomerCreditSummary(
        total_credit=total_credit,
        total_paid=total_paid,
        total_balance=total_balance,
        credits=[_build_credit_response(c) for c in credits],
    )


# ── Admin: list all pending credits ───────────────────────────────────────────

@router.get("/credits", response_model=dict)
async def list_credits(
    status_filter: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = (
        select(CustomerCredit)
        .options(
            selectinload(CustomerCredit.customer),
            selectinload(CustomerCredit.sale),
            selectinload(CustomerCredit.payments),
        )
    )
    if status_filter:
        stmt = stmt.where(CustomerCredit.status == status_filter)
    else:
        stmt = stmt.where(CustomerCredit.status.in_(["pending", "partial"]))

    total_q = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = total_q.scalar_one()

    result = await db.execute(
        stmt.order_by(CustomerCredit.created_at.desc())
        .offset((page - 1) * size).limit(size)
    )
    credits = result.scalars().all()

    items = []
    for c in credits:
        items.append({
            **_build_credit_response(c).model_dump(),
            "customer_full_name": c.customer.full_name if c.customer else "",
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": max(1, math.ceil(total / size)),
    }


# ── Add payment (abono) ────────────────────────────────────────────────────────

@router.post("/credits/{credit_id}/payments", response_model=CustomerCreditResponse, status_code=status.HTTP_201_CREATED)
async def add_payment(
    credit_id: int,
    data: CreditPaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CustomerCredit)
        .options(selectinload(CustomerCredit.payments), selectinload(CustomerCredit.sale))
        .where(CustomerCredit.id == credit_id)
    )
    credit = result.scalar_one_or_none()
    if not credit:
        raise HTTPException(status_code=404, detail="Crédito no encontrado")
    if credit.status == "paid":
        raise HTTPException(status_code=400, detail="Este crédito ya está pagado")
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="El monto del abono debe ser mayor a 0")
    if data.amount > credit.balance:
        raise HTTPException(
            status_code=400,
            detail=f"El abono (${data.amount}) supera el saldo pendiente (${credit.balance})",
        )

    payment = CreditPayment(
        credit_id=credit.id,
        amount=data.amount,
        payment_method=data.payment_method,
        notes=data.notes,
        paid_by_id=current_user.id,
    )
    db.add(payment)

    credit.paid_amount += data.amount
    new_balance = credit.original_amount - credit.paid_amount
    credit.status = "paid" if new_balance <= 0 else "partial"

    await db.commit()
    await db.refresh(credit)

    logger.info(
        "[CREDIT_PAYMENT] credit_id=%s amount=%s method=%s balance_after=%s by=%s",
        credit_id, data.amount, data.payment_method, credit.balance, current_user.username,
    )
    return _build_credit_response(credit)
