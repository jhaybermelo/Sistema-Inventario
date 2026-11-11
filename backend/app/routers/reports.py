from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, datetime, timezone
import calendar
import io
from app.database import get_db
from app.models.user import User
from app.core.dependencies import get_current_user
from app.core.logging_config import get_logger
from app.repositories.sale_repository import SaleRepository
from app.repositories.product_repository import ProductRepository
from app.services.report_service import generate_pdf_report, generate_docx_report
from app.config import settings

logger = get_logger("reports", settings.LOG_DIR)


def _strip_profit(summary: list[dict]) -> list[dict]:
    return [{k: (0 if k == 'total_cost' else v) for k, v in s.items()} for s in summary]

router = APIRouter(prefix="/reports", tags=["reports"])


async def _get_report_data(db: AsyncSession, date_from: date, date_to: date) -> dict:
    repo = SaleRepository(db)
    product_repo = ProductRepository(db)
    sales, total = await repo.get_list(date_from=date_from, date_to=date_to, size=1000)
    summary = await repo.get_range_summary(date_from, date_to)
    low_stock_count = await product_repo.count_low_stock()
    return {
        "sales": sales,
        "summary": summary,
        "low_stock_count": low_stock_count,
        "date_from": date_from,
        "date_to": date_to,
    }


@router.get("/daily")
async def daily_report_data(
    report_date: date = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not report_date:
        report_date = datetime.now(timezone.utc).date()
    repo = SaleRepository(db)
    summary = await repo.get_daily_summary(report_date)
    items = [summary]
    if current_user.role != 'admin':
        items = _strip_profit(items)
    return {
        "summary": items,
        "date_from": report_date.isoformat(),
        "date_to": report_date.isoformat(),
    }


@router.get("/daily/pdf")
async def daily_pdf(
    report_date: date = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not report_date:
        report_date = datetime.now(timezone.utc).date()
    data = await _get_report_data(db, report_date, report_date)
    pdf_bytes = generate_pdf_report(data)
    filename = f"reporte_{report_date.isoformat()}.pdf"
    logger.info("[REPORT_DOWNLOAD] type=daily date=%s format=pdf user=%s", report_date, _.id)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/daily/docx")
async def daily_docx(
    report_date: date = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not report_date:
        report_date = datetime.now(timezone.utc).date()
    data = await _get_report_data(db, report_date, report_date)
    docx_bytes = generate_docx_report(data)
    filename = f"reporte_{report_date.isoformat()}.docx"
    logger.info("[REPORT_DOWNLOAD] type=daily date=%s format=docx user=%s", report_date, _.id)
    return StreamingResponse(
        io.BytesIO(docx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/range/pdf")
async def range_pdf(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    data = await _get_report_data(db, date_from, date_to)
    pdf_bytes = generate_pdf_report(data)
    filename = f"reporte_{date_from}_{date_to}.pdf"
    logger.info("[REPORT_DOWNLOAD] type=range from=%s to=%s format=pdf user=%s", date_from, date_to, _.id)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/range/docx")
async def range_docx(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    data = await _get_report_data(db, date_from, date_to)
    docx_bytes = generate_docx_report(data)
    filename = f"reporte_{date_from}_{date_to}.docx"
    logger.info("[REPORT_DOWNLOAD] type=range from=%s to=%s format=docx user=%s", date_from, date_to, _.id)
    return StreamingResponse(
        io.BytesIO(docx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/range")
async def range_report_data(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = SaleRepository(db)
    summary = await repo.get_range_summary(date_from, date_to)
    if current_user.role != 'admin':
        summary = _strip_profit(summary)
    return {"summary": summary, "date_from": date_from.isoformat(), "date_to": date_to.isoformat()}


@router.get("/monthly")
async def monthly_report_data(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    last_day = calendar.monthrange(year, month)[1]
    date_from = date(year, month, 1)
    date_to = date(year, month, last_day)
    repo = SaleRepository(db)
    summary = await repo.get_range_summary(date_from, date_to)
    if current_user.role != 'admin':
        summary = _strip_profit(summary)
    return {"summary": summary, "date_from": date_from.isoformat(), "date_to": date_to.isoformat()}


@router.get("/monthly/pdf")
async def monthly_pdf(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    last_day = calendar.monthrange(year, month)[1]
    date_from = date(year, month, 1)
    date_to = date(year, month, last_day)
    data = await _get_report_data(db, date_from, date_to)
    pdf_bytes = generate_pdf_report(data)
    filename = f"reporte_{year}_{month:02d}.pdf"
    logger.info("[REPORT_DOWNLOAD] type=monthly year=%s month=%s format=pdf user=%s", year, month, _.id)
    return StreamingResponse(
        io.BytesIO(pdf_bytes), media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/monthly/docx")
async def monthly_docx(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    last_day = calendar.monthrange(year, month)[1]
    date_from = date(year, month, 1)
    date_to = date(year, month, last_day)
    data = await _get_report_data(db, date_from, date_to)
    docx_bytes = generate_docx_report(data)
    filename = f"reporte_{year}_{month:02d}.docx"
    logger.info("[REPORT_DOWNLOAD] type=monthly year=%s month=%s format=docx user=%s", year, month, _.id)
    return StreamingResponse(
        io.BytesIO(docx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/dashboard")
async def dashboard_data(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from datetime import timedelta
    today = datetime.now(timezone.utc).date()
    repo = SaleRepository(db)
    product_repo = ProductRepository(db)

    today_summary = await repo.get_daily_summary(today)
    week_start = today - timedelta(days=6)
    week_summary = await repo.get_range_summary(week_start, today)
    low_stock = await product_repo.count_low_stock()

    return {
        "today": today_summary,
        "week": week_summary,
        "low_stock_count": low_stock,
    }
