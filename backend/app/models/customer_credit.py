from sqlalchemy import String, ForeignKey, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime
from decimal import Decimal
from typing import Optional
from app.database import Base


class CustomerCredit(Base):
    __tablename__ = "customer_credits"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False, index=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id"), nullable=False)
    original_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)  # pending|partial|paid
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())

    customer: Mapped["Customer"] = relationship(back_populates="credits")
    sale: Mapped["Sale"] = relationship(back_populates="credit")
    payments: Mapped[list["CreditPayment"]] = relationship(back_populates="credit", cascade="all, delete-orphan")

    @property
    def balance(self) -> Decimal:
        return self.original_amount - self.paid_amount


class CreditPayment(Base):
    __tablename__ = "credit_payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    credit_id: Mapped[int] = mapped_column(ForeignKey("customer_credits.id", ondelete="CASCADE"), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(20), default="cash")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    paid_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=func.now())

    credit: Mapped["CustomerCredit"] = relationship(back_populates="payments")
    paid_by: Mapped[Optional["User"]] = relationship()
