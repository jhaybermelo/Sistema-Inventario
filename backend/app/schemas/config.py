from pydantic import BaseModel, computed_field
from decimal import Decimal
from typing import Optional


class BusinessConfigUpdate(BaseModel):
    business_name: Optional[str] = None
    business_type: Optional[str] = None
    nit: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    receipt_footer: Optional[str] = None
    tax_rate: Optional[Decimal] = None
    currency_symbol: Optional[str] = None
    low_stock_alert_enabled: Optional[bool] = None
    notify_email: Optional[str] = None
    notify_whatsapp: Optional[str] = None
    email_notifications_enabled: Optional[bool] = None
    whatsapp_notifications_enabled: Optional[bool] = None


class BusinessConfigResponse(BaseModel):
    id: int
    business_name: str
    business_type: str
    nit: Optional[str]
    address: Optional[str]
    phone: Optional[str]
    logo_path: Optional[str]
    receipt_footer: Optional[str]
    tax_rate: Decimal
    currency_symbol: str
    low_stock_alert_enabled: bool
    notify_email: Optional[str] = None
    notify_whatsapp: Optional[str] = None
    email_notifications_enabled: bool = False
    whatsapp_notifications_enabled: bool = False

    @computed_field
    @property
    def logo_url(self) -> Optional[str]:
        if self.logo_path:
            return "/" + self.logo_path.replace("\\", "/")
        return None

    model_config = {"from_attributes": True}


class PublicConfigResponse(BaseModel):
    business_name: str
    logo_url: Optional[str] = None
    currency_symbol: str
