from pydantic import BaseModel, model_validator
from decimal import Decimal
from datetime import datetime
from typing import Optional


def _blank_to_none(v: Optional[str]) -> Optional[str]:
    return v.strip() or None if v else None


class CustomerCreate(BaseModel):
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    document_id: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None

    @model_validator(mode='after')
    def strip_blanks(self) -> 'CustomerCreate':
        self.email = _blank_to_none(self.email)
        self.phone = _blank_to_none(self.phone)
        self.document_id = _blank_to_none(self.document_id)
        self.address = _blank_to_none(self.address)
        self.notes = _blank_to_none(self.notes)
        return self


class CustomerUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    document_id: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

    @model_validator(mode='after')
    def strip_blanks(self) -> 'CustomerUpdate':
        self.email = _blank_to_none(self.email)
        self.phone = _blank_to_none(self.phone)
        self.document_id = _blank_to_none(self.document_id)
        self.address = _blank_to_none(self.address)
        self.notes = _blank_to_none(self.notes)
        return self


class CustomerResponse(BaseModel):
    id: int
    full_name: str
    email: Optional[str]
    phone: Optional[str]
    document_id: Optional[str]
    address: Optional[str]
    notes: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    total_purchases: int = 0
    total_spent: Decimal = Decimal("0")
    last_purchase_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CustomerListItem(BaseModel):
    id: int
    full_name: str
    email: Optional[str]
    phone: Optional[str]
    document_id: Optional[str]
    is_active: bool
    created_at: datetime
    total_purchases: int = 0
    total_spent: Decimal = Decimal("0")

    model_config = {"from_attributes": True}


class CustomerListResponse(BaseModel):
    items: list[CustomerListItem]
    total: int
    page: int
    pages: int
