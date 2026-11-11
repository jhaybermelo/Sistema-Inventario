import math
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone
from decimal import Decimal
from app.database import get_db
from app.models.user import User
from app.models.sale import Sale
from app.models.cash_session import CashSession, CashExpense
from app.core.dependencies import get_current_user, require_admin
from app.core.logging_config import get_logger
from app.schemas.cash_session import (
    CashSessionOpen, CashSessionClose, CashExpenseCreate,
    CashSessionResponse, CashSessionListItem, CashExpenseResponse,
)
from app.config import settings

router = APIRouter(prefix="/cash", tags=["cash"])
logger = get_logger("cash", settings.LOG_DIR)


async def _compute_stats(db: AsyncSession, session: CashSession) -> tuple[Decimal, Decimal]:
    """Returns (cash_sales, total_expenses) for an open or closed session."""
    end = session.closed_at or datetime.now(timezone.utc)

    cash_q = await db.execute(
        select(func.coalesce(func.sum(Sale.total), 0)).where(
            Sale.user_id == session.user_id,
            Sale.payment_method == "cash",
            Sale.status == "completed",
            Sale.created_at >= session.opened_at,
            Sale.created_at <= end,
        )
    )
    cash_sales = Decimal(str(cash_q.scalar()))

    exp_q = await db.execute(
        select(func.coalesce(func.sum(CashExpense.amount), 0)).where(
            CashExpense.session_id == session.id
        )
    )
    total_expenses = Decimal(str(exp_q.scalar()))
    return cash_sales, total_expenses


def _build_response(session: CashSession, cash_sales: Decimal, total_expenses: Decimal) -> CashSessionResponse:
    expected = session.opening_amount + cash_sales - total_expenses
    return CashSessionResponse(
        id=session.id,
        user_id=session.user_id,
        user_full_name=session.user.full_name,
        opening_amount=session.opening_amount,
        closing_amount=session.closing_amount,
        expected_amount=session.expected_amount if session.status == "closed" else expected,
        difference=session.difference,
        status=session.status,
        notes=session.notes,
        opened_at=session.opened_at,
        closed_at=session.closed_at,
        expenses=[CashExpenseResponse.model_validate(e) for e in session.expenses],
        cash_sales=cash_sales,
        total_expenses=total_expenses,
    )


# ── Current session ───────────────────────────────────────────────────────────

@router.get("/current")
async def get_current_session(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CashSession)
        .where(CashSession.user_id == current_user.id, CashSession.status == "open")
        .order_by(CashSession.opened_at.desc())
        .limit(1)
    )
    session = result.scalar_one_or_none()
    if not session:
        return None
    cash_sales, total_expenses = await _compute_stats(db, session)
    return _build_response(session, cash_sales, total_expenses)


# ── Open session ──────────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def open_session(
    data: CashSessionOpen,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check no session already open for this user
    existing = await db.execute(
        select(CashSession).where(
            CashSession.user_id == current_user.id,
            CashSession.status == "open",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya tienes una sesión de caja abierta")

    session = CashSession(user_id=current_user.id, opening_amount=data.opening_amount)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    logger.info("[CASH_OPEN] user=%s opening=%s", current_user.username, data.opening_amount)
    return _build_response(session, Decimal("0"), Decimal("0"))


# ── Add expense ───────────────────────────────────────────────────────────────

@router.post("/{session_id}/expenses", status_code=status.HTTP_201_CREATED)
async def add_expense(
    session_id: int,
    data: CashExpenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await _get_open_session(db, session_id, current_user)
    expense = CashExpense(session_id=session.id, amount=data.amount, description=data.description)
    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    logger.info("[CASH_EXPENSE] user=%s session=%s amount=%s desc=%r", current_user.username, session_id, data.amount, data.description)
    return CashExpenseResponse.model_validate(expense)


# ── Delete expense ────────────────────────────────────────────────────────────

@router.delete("/{session_id}/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    session_id: int,
    expense_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_open_session(db, session_id, current_user)
    result = await db.execute(
        select(CashExpense).where(CashExpense.id == expense_id, CashExpense.session_id == session_id)
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Egreso no encontrado")
    await db.delete(expense)
    await db.commit()


# ── Close session ─────────────────────────────────────────────────────────────

@router.post("/{session_id}/close")
async def close_session(
    session_id: int,
    data: CashSessionClose,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await _get_open_session(db, session_id, current_user)
    cash_sales, total_expenses = await _compute_stats(db, session)
    expected = session.opening_amount + cash_sales - total_expenses
    difference = data.closing_amount - expected

    session.closing_amount = data.closing_amount
    session.expected_amount = expected
    session.difference = difference
    session.notes = data.notes
    session.status = "closed"
    session.closed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(session)
    logger.info(
        "[CASH_CLOSE] user=%s session=%s expected=%s counted=%s diff=%s",
        current_user.username, session_id, expected, data.closing_amount, difference,
    )
    return _build_response(session, cash_sales, total_expenses)


# ── History (admin) ───────────────────────────────────────────────────────────

@router.get("/history")
async def list_sessions(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    from sqlalchemy.orm import selectinload
    total_q = await db.execute(select(func.count()).select_from(CashSession))
    total = total_q.scalar_one()

    result = await db.execute(
        select(CashSession)
        .options(selectinload(CashSession.user))
        .order_by(CashSession.opened_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    sessions = result.scalars().all()

    return {
        "items": [
            {
                "id": s.id,
                "user_full_name": s.user.full_name,
                "opening_amount": str(s.opening_amount),
                "closing_amount": str(s.closing_amount) if s.closing_amount is not None else None,
                "expected_amount": str(s.expected_amount) if s.expected_amount is not None else None,
                "difference": str(s.difference) if s.difference is not None else None,
                "status": s.status,
                "opened_at": s.opened_at.isoformat(),
                "closed_at": s.closed_at.isoformat() if s.closed_at else None,
            }
            for s in sessions
        ],
        "total": total,
        "page": page,
        "pages": max(1, math.ceil(total / size)),
    }


# ── Helper ────────────────────────────────────────────────────────────────────

async def _get_open_session(db: AsyncSession, session_id: int, current_user: User) -> CashSession:
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(CashSession)
        .options(selectinload(CashSession.user), selectinload(CashSession.expenses))
        .where(CashSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión de caja no encontrada")
    if session.status != "open":
        raise HTTPException(status_code=400, detail="Esta sesión ya está cerrada")
    if session.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="No tienes permiso sobre esta sesión")
    return session
