from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Text, DateTime, func
from datetime import datetime
from app.database import Base


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    channel: Mapped[str] = mapped_column(String(20))       # email | whatsapp
    status: Mapped[str] = mapped_column(String(20))        # success | failed | skipped
    recipient: Mapped[str] = mapped_column(String(500))    # email(s) or phone(s)
    message: Mapped[str] = mapped_column(Text)             # products that triggered the alert
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
