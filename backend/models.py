from datetime import datetime

from sqlalchemy import (
    String, Text, DateTime, Boolean, func
)
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Station(Base):
    __tablename__ = "stations"

    number: Mapped[int] = mapped_column(
        primary_key=True
    )

    station_name: Mapped[str] = mapped_column(
        String(200), nullable=False
    )

    operator: Mapped[str | None] = mapped_column(
        String(200)
    )

    address: Mapped[str | None] = mapped_column(
        String(500)
    )

    monitoring_installed: Mapped[str | None] = mapped_column(
        String(50)
    )

    modbus_status: Mapped[str | None] = mapped_column(
        String(50)
    )

    communication_failure: Mapped[bool | None] = mapped_column(
        Boolean, nullable=True
    )

    srp: Mapped[str | None] = mapped_column(String(200))
    blue: Mapped[str | None] = mapped_column(String(200))
    ip: Mapped[str | None] = mapped_column(String(100))
    port: Mapped[str | None] = mapped_column(String(30))

    matrix_installed: Mapped[str | None] = mapped_column(
        String(50)
    )

    latest_history: Mapped[str | None] = mapped_column(Text)
    other_history: Mapped[str | None] = mapped_column(Text)

    last_saved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )