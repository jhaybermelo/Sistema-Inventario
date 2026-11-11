from sqlalchemy import String, Boolean, Text, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from decimal import Decimal
from app.database import Base


class BusinessConfig(Base):
    __tablename__ = "business_config"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_name: Mapped[str] = mapped_column(String(200), nullable=False)
    business_type: Mapped[str] = mapped_column(String(20), default="general")
    nit: Mapped[str | None] = mapped_column(String(20))
    address: Mapped[str | None] = mapped_column(String(300))
    phone: Mapped[str | None] = mapped_column(String(20))
    logo_path: Mapped[str | None] = mapped_column(String(500))
    receipt_footer: Mapped[str | None] = mapped_column(Text)
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    currency_symbol: Mapped[str] = mapped_column(String(5), default="$")
    low_stock_alert_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    # Notification recipients (stored here so admin can change from UI)
    notify_email: Mapped[str | None] = mapped_column(String(200))       # email(s) to receive alerts, comma-separated
    notify_whatsapp: Mapped[str | None] = mapped_column(String(200))    # phone(s) e.g. "+573001234567,+573009876543"
    email_notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    whatsapp_notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
