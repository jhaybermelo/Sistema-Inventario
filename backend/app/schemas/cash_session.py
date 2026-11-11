from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime
from typing import Optional


class CashSessionOpen(BaseModel):
    opening_amount: Decimal


class CashSessionClose(BaseModel):
    closing_amount: Decimal
    notes: Optional[str] = None


class CashExpenseCreate(BaseModel):
    amount: Decimal
    description: str


class CashExpenseResponse(BaseModel):
    id: int
    amount: Decimal
    description: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CashSessionResponse(BaseModel):
    id: int
    user_id: int
    user_full_name: str
    opening_amount: Decimal
    closing_amount: Optional[Decimal]
    expected_amount: Optional[Decimal]
    difference: Optional[Decimal]
    status: str
    notes: Optional[str]
    opened_at: datetime
    closed_at: Optional[datetime]
    expenses: list[CashExpenseResponse]
    # Computed live (only when status=open)
    cash_sales: Decimal = Decimal("0")
    total_expenses: Decimal = Decimal("0")

    model_config = {"from_attributes": True}


class CashSessionListItem(BaseModel):
    id: int
    user_full_name: str
    opening_amount: Decimal
    closing_amount: Optional[Decimal]
    expected_amount: Optional[Decimal]
    difference: Optional[Decimal]
    status: str
    opened_at: datetime
    closed_at: Optional[datetime]

    model_config = {"from_attributes": True}
