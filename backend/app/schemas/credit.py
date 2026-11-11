from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime
from typing import Optional


class CreditPaymentCreate(BaseModel):
    amount: Decimal
    payment_method: str = "cash"
    notes: Optional[str] = None


class CreditPaymentResponse(BaseModel):
    id: int
    amount: Decimal
    payment_method: str
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class CustomerCreditResponse(BaseModel):
    id: int
    customer_id: int
    sale_id: int
    sale_number: str = ""
    original_amount: Decimal
    paid_amount: Decimal
    balance: Decimal
    status: str
    notes: Optional[str]
    created_at: datetime
    payments: list[CreditPaymentResponse] = []

    model_config = {"from_attributes": True}


class CustomerCreditSummary(BaseModel):
    total_credit: Decimal       # suma de todos los créditos originales
    total_paid: Decimal         # total abonado
    total_balance: Decimal      # saldo pendiente
    credits: list[CustomerCreditResponse]
