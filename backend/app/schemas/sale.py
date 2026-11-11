from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime
from typing import Optional


class SaleItemCreate(BaseModel):
    product_id: int
    quantity: int
    discount: Decimal = Decimal("0")


class SaleCreate(BaseModel):
    items: list[SaleItemCreate]
    payment_method: str = "cash"
    discount_amount: Decimal = Decimal("0")
    notes: Optional[str] = None
    customer_id: Optional[int] = None
    paid_amount: Optional[Decimal] = None   # None = pago completo


class SaleItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    product_sku: str
    unit_price: Decimal
    quantity: int
    discount: Decimal
    line_total: Decimal

    model_config = {"from_attributes": True}


class SaleResponse(BaseModel):
    id: int
    sale_number: str
    user_id: int
    customer_id: Optional[int] = None
    customer_full_name: Optional[str] = None
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    total: Decimal
    paid_amount: Decimal = Decimal("0")
    credit_amount: Decimal = Decimal("0")
    payment_method: str
    status: str
    notes: Optional[str]
    created_at: datetime
    items: list[SaleItemResponse] = []

    model_config = {"from_attributes": True}



class SaleListResponse(BaseModel):
    items: list[SaleResponse]
    total: int
    page: int
    size: int
    pages: int
