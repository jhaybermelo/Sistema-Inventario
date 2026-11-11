from pydantic import BaseModel, Field
from decimal import Decimal
from typing import Optional, List
from datetime import datetime


class PurchaseItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)
    unit_cost: Decimal = Field(ge=0)


class PurchaseCreate(BaseModel):
    supplier_name: Optional[str] = None
    items: List[PurchaseItemCreate] = Field(min_length=1)
    notes: Optional[str] = None
    update_costs: bool = True


class PurchaseItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    product_sku: str
    quantity: int
    unit_cost: Decimal
    line_total: Decimal

    model_config = {"from_attributes": True}


class PurchaseResponse(BaseModel):
    id: int
    purchase_number: str
    supplier_name: Optional[str]
    user_id: int
    total: Decimal
    status: str
    notes: Optional[str]
    created_at: datetime
    items: List[PurchaseItemResponse]

    model_config = {"from_attributes": True}


class PurchaseListResponse(BaseModel):
    items: List[PurchaseResponse]
    total: int
    page: int
    size: int
    pages: int
