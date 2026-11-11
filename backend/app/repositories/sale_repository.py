from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import date, datetime, timezone, timedelta
from typing import Optional, List
from decimal import Decimal
from app.models.sale import Sale
from app.models.sale_item import SaleItem


class SaleRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, sale_id: int) -> Optional[Sale]:
        result = await self.db.execute(
            select(Sale)
            .options(selectinload(Sale.items), selectinload(Sale.customer))
            .where(Sale.id == sale_id)
        )
        return result.scalar_one_or_none()

    async def get_by_number(self, sale_number: str) -> Optional[Sale]:
        result = await self.db.execute(
            select(Sale).options(selectinload(Sale.items)).where(Sale.sale_number == sale_number)
        )
        return result.scalar_one_or_none()

    async def get_list(
        self,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        payment_method: Optional[str] = None,
        status: Optional[str] = None,
        sale_number: Optional[str] = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple:
        stmt = select(Sale).options(selectinload(Sale.items), selectinload(Sale.customer))

        if date_from:
            stmt = stmt.where(Sale.created_at >= datetime(date_from.year, date_from.month, date_from.day))
        if date_to:
            end = datetime(date_to.year, date_to.month, date_to.day) + timedelta(days=1)
            stmt = stmt.where(Sale.created_at < end)
        if payment_method:
            stmt = stmt.where(Sale.payment_method == payment_method)
        if status:
            stmt = stmt.where(Sale.status == status)
        if sale_number:
            stmt = stmt.where(Sale.sale_number.ilike(f"%{sale_number}%"))

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = stmt.order_by(Sale.created_at.desc()).offset((page - 1) * size).limit(size)
        result = await self.db.execute(stmt)
        return result.scalars().all(), total

    async def generate_sale_number(self) -> str:
        today = datetime.now(timezone.utc).strftime("%Y%m%d")
        result = await self.db.execute(
            select(func.count(Sale.id)).where(Sale.sale_number.like(f"SALE-{today}-%"))
        )
        count = result.scalar_one()
        return f"SALE-{today}-{count + 1:04d}"

    async def get_daily_summary(self, target_date: date) -> dict:
        start = datetime(target_date.year, target_date.month, target_date.day)
        end = start + timedelta(days=1)

        result = await self.db.execute(
            select(
                func.count(func.distinct(Sale.id)).label("transaction_count"),
                func.coalesce(func.sum(Sale.total), 0).label("total_revenue"),
                func.coalesce(func.sum(Sale.tax_amount), 0).label("total_tax"),
                func.coalesce(
                    func.sum(func.coalesce(SaleItem.unit_cost, 0) * SaleItem.quantity), 0
                ).label("total_cost"),
            )
            .select_from(Sale)
            .outerjoin(SaleItem, SaleItem.sale_id == Sale.id)
            .where(
                Sale.created_at >= start,
                Sale.created_at < end,
                Sale.status == "completed",
            )
        )
        row = result.one()
        revenue = Decimal(str(row.total_revenue))
        cost = Decimal(str(row.total_cost))
        gross_profit = revenue - cost
        margin = (gross_profit / revenue * 100).quantize(Decimal("0.01")) if revenue > 0 else Decimal("0")
        return {
            "date": target_date.isoformat(),
            "transaction_count": row.transaction_count,
            "total_revenue": revenue,
            "total_tax": Decimal(str(row.total_tax)),
            "total_cost": cost,
            "gross_profit": gross_profit,
            "profit_margin": margin,
        }

    async def get_range_summary(self, date_from: date, date_to: date) -> List[dict]:
        results = []
        current = date_from
        while current <= date_to:
            summary = await self.get_daily_summary(current)
            results.append(summary)
            current += timedelta(days=1)
        return results
