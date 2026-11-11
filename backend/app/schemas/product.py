from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime
from typing import Optional, Any


class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    is_active: bool

    model_config = {"from_attributes": True}


class ProductCreate(BaseModel):
    name: str
    sku: str
    barcode: Optional[str] = None
    description: Optional[str] = None
    price: Decimal
    cost: Optional[Decimal] = None
    quantity: int = 0
    low_stock_threshold: int = 5
    category_id: Optional[int] = None
    attributes: Optional[dict[str, Any]] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    barcode: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None
    cost: Optional[Decimal] = None
    quantity: Optional[int] = None
    low_stock_threshold: Optional[int] = None
    category_id: Optional[int] = None
    is_active: Optional[bool] = None
    attributes: Optional[dict[str, Any]] = None


class ProductResponse(BaseModel):
    id: int
    name: str
    sku: str
    barcode: Optional[str]
    description: Optional[str]
    price: Decimal
    cost: Optional[Decimal]
    quantity: int
    low_stock_threshold: int
    category_id: Optional[int]
    category: Optional[CategoryResponse]
    is_active: bool
    attributes: Optional[dict[str, Any]]
    created_at: datetime
    updated_at: datetime
    is_low_stock: bool = False

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_flags(cls, product) -> "ProductResponse":
        data = cls.model_validate(product)
        data.is_low_stock = product.quantity <= product.low_stock_threshold
        return data


class ProductListResponse(BaseModel):
    items: list[ProductResponse]
    total: int
    page: int
    size: int
    pages: int


class CSVImportPreview(BaseModel):
    valid_rows: list[dict]
    error_rows: list[dict]
    total: int
