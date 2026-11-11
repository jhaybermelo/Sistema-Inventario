from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
import io
from decimal import Decimal
from datetime import date


NAVY = colors.HexColor("#1e3a5f")
LIGHT_ROW = colors.HexColor("#f5f5f5")
GREEN = colors.HexColor("#16a34a")
RED = colors.HexColor("#dc2626")


def _fmt(value) -> str:
    return f"${Decimal(str(value)):,.2f}"


def _profit_totals(summary: list) -> dict:
    revenue = sum(Decimal(str(s["total_revenue"])) for s in summary)
    cost = sum(Decimal(str(s.get("total_cost", 0))) for s in summary)
    tax = sum(Decimal(str(s.get("total_tax", 0))) for s in summary)
    transactions = sum(s["transaction_count"] for s in summary)
    gross_profit = revenue - cost
    margin = (gross_profit / revenue * 100).quantize(Decimal("0.01")) if revenue > 0 else Decimal("0")
    return {
        "revenue": revenue,
        "cost": cost,
        "tax": tax,
        "gross_profit": gross_profit,
        "margin": margin,
        "transactions": transactions,
    }


def _table_style(col_count: int) -> TableStyle:
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.lightgrey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_ROW]),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ])


def generate_pdf_report(data: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        leftMargin=2*cm, rightMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Title"], fontSize=16, spaceAfter=4)
    subtitle_style = ParagraphStyle("sub", parent=styles["Normal"], fontSize=10, textColor=colors.grey, spaceAfter=14)
    heading_style = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=12, spaceBefore=14, spaceAfter=6)

    date_from: date = data["date_from"]
    date_to: date = data["date_to"]
    if date_from == date_to:
        subtitle = f"Fecha: {date_from.strftime('%d/%m/%Y')}"
    else:
        subtitle = f"Del {date_from.strftime('%d/%m/%Y')} al {date_to.strftime('%d/%m/%Y')}"

    story = [
        Paragraph("Reporte de Ventas y Ganancias", title_style),
        Paragraph(subtitle, subtitle_style),
    ]

    summary = data.get("summary", [])
    totals = _profit_totals(summary)

    # ── KPI summary ──────────────────────────────────────────────────────────
    story.append(Paragraph("Resumen General", heading_style))
    kpi_data = [
        ["Ingresos Totales", "Costo Total", "Ganancia Bruta", "Margen", "Transacciones"],
        [
            _fmt(totals["revenue"]),
            _fmt(totals["cost"]),
            _fmt(totals["gross_profit"]),
            f"{totals['margin']}%",
            str(totals["transactions"]),
        ],
    ]
    kpi_table = Table(kpi_data, colWidths=[3.8*cm, 3.8*cm, 3.8*cm, 2.5*cm, 3*cm])
    kpi_style = _table_style(5)
    kpi_style.add("ALIGN", (0, 0), (-1, -1), "CENTER")
    kpi_style.add("FONTSIZE", (0, 1), (-1, -1), 10)
    kpi_style.add("FONTNAME", (0, 1), (-1, -1), "Helvetica-Bold")
    kpi_table.setStyle(kpi_style)
    story.append(kpi_table)
    story.append(Spacer(1, 0.4*cm))

    # ── Daily breakdown ───────────────────────────────────────────────────────
    active_days = [s for s in summary if s["transaction_count"] > 0]
    if active_days:
        label = "Desglose por Día" if len(summary) > 1 else "Detalle del Día"
        story.append(Paragraph(label, heading_style))
        daily_data = [["Fecha", "Transacciones", "Ingresos", "Costo", "Ganancia", "Margen %"]]
        for s in active_days:
            rev = Decimal(str(s["total_revenue"]))
            cost = Decimal(str(s.get("total_cost", 0)))
            profit = rev - cost
            margin = (profit / rev * 100).quantize(Decimal("0.01")) if rev > 0 else Decimal("0")
            daily_data.append([
                s["date"],
                str(s["transaction_count"]),
                _fmt(rev),
                _fmt(cost),
                _fmt(profit),
                f"{margin}%",
            ])
        # Totals row
        daily_data.append([
            "TOTAL",
            str(totals["transactions"]),
            _fmt(totals["revenue"]),
            _fmt(totals["cost"]),
            _fmt(totals["gross_profit"]),
            f"{totals['margin']}%",
        ])
        t2 = Table(daily_data, colWidths=[2.8*cm, 2.8*cm, 3.5*cm, 3.5*cm, 3.5*cm, 2.5*cm])
        style2 = _table_style(6)
        style2.add("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold")
        style2.add("BACKGROUND", (0, -1), (-1, -1), LIGHT_ROW)
        t2.setStyle(style2)
        story.append(t2)
        story.append(Spacer(1, 0.4*cm))

    # ── Sales detail ──────────────────────────────────────────────────────────
    sales = data.get("sales", [])
    if sales:
        story.append(Paragraph("Detalle de Transacciones", heading_style))
        sale_data = [["#", "Número de Venta", "Método de Pago", "Estado", "Total"]]
        for sale in sales:
            sale_data.append([
                str(sale.id),
                sale.sale_number,
                sale.payment_method,
                sale.status,
                _fmt(sale.total),
            ])
        t3 = Table(sale_data, colWidths=[1.5*cm, 5.5*cm, 3.5*cm, 3*cm, 3.5*cm])
        t3.setStyle(_table_style(5))
        story.append(t3)

    doc.build(story)
    return buf.getvalue()


def generate_docx_report(data: dict) -> bytes:
    doc = Document()

    # Page margins
    for section in doc.sections:
        section.top_margin = Cm(2)
        section.bottom_margin = Cm(2)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2.5)

    date_from: date = data["date_from"]
    date_to: date = data["date_to"]
    if date_from == date_to:
        subtitle_text = f"Fecha: {date_from.strftime('%d/%m/%Y')}"
    else:
        subtitle_text = f"Del {date_from.strftime('%d/%m/%Y')} al {date_to.strftime('%d/%m/%Y')}"

    h = doc.add_heading("Reporte de Ventas y Ganancias", level=1)
    h.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p = doc.add_paragraph(subtitle_text)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.runs[0].font.color.rgb = RGBColor(0x66, 0x66, 0x66)
    doc.add_paragraph()

    summary = data.get("summary", [])
    totals = _profit_totals(summary)

    # ── KPI summary ──────────────────────────────────────────────────────────
    doc.add_heading("Resumen General", level=2)
    kpi_table = doc.add_table(rows=2, cols=5)
    kpi_table.style = "Table Grid"
    kpi_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    kpi_headers = ["Ingresos Totales", "Costo Total", "Ganancia Bruta", "Margen %", "Transacciones"]
    kpi_values = [
        _fmt(totals["revenue"]),
        _fmt(totals["cost"]),
        _fmt(totals["gross_profit"]),
        f"{totals['margin']}%",
        str(totals["transactions"]),
    ]
    for i, (h_txt, v_txt) in enumerate(zip(kpi_headers, kpi_values)):
        hcell = kpi_table.rows[0].cells[i]
        hcell.text = h_txt
        hcell.paragraphs[0].runs[0].bold = True
        kpi_table.rows[1].cells[i].text = v_txt

    doc.add_paragraph()

    # ── Daily breakdown ───────────────────────────────────────────────────────
    active_days = [s for s in summary if s["transaction_count"] > 0]
    if active_days:
        label = "Desglose por Día" if len(summary) > 1 else "Detalle del Día"
        doc.add_heading(label, level=2)
        day_table = doc.add_table(rows=1 + len(active_days) + 1, cols=6)
        day_table.style = "Table Grid"
        day_headers = ["Fecha", "Transac.", "Ingresos", "Costo", "Ganancia", "Margen %"]
        for i, h_txt in enumerate(day_headers):
            c = day_table.rows[0].cells[i]
            c.text = h_txt
            c.paragraphs[0].runs[0].bold = True

        for ri, s in enumerate(active_days, start=1):
            rev = Decimal(str(s["total_revenue"]))
            cost = Decimal(str(s.get("total_cost", 0)))
            profit = rev - cost
            margin = (profit / rev * 100).quantize(Decimal("0.01")) if rev > 0 else Decimal("0")
            row = day_table.rows[ri]
            row.cells[0].text = s["date"]
            row.cells[1].text = str(s["transaction_count"])
            row.cells[2].text = _fmt(rev)
            row.cells[3].text = _fmt(cost)
            row.cells[4].text = _fmt(profit)
            row.cells[5].text = f"{margin}%"

        total_row = day_table.rows[-1]
        for i, txt in enumerate(["TOTAL", str(totals["transactions"]), _fmt(totals["revenue"]),
                                   _fmt(totals["cost"]), _fmt(totals["gross_profit"]), f"{totals['margin']}%"]):
            total_row.cells[i].text = txt
            total_row.cells[i].paragraphs[0].runs[0].bold = True

        doc.add_paragraph()

    # ── Sales detail ──────────────────────────────────────────────────────────
    sales = data.get("sales", [])
    if sales:
        doc.add_heading("Detalle de Transacciones", level=2)
        sale_table = doc.add_table(rows=1 + len(sales), cols=5)
        sale_table.style = "Table Grid"
        for i, h_txt in enumerate(["#", "Número de Venta", "Método de Pago", "Estado", "Total"]):
            c = sale_table.rows[0].cells[i]
            c.text = h_txt
            c.paragraphs[0].runs[0].bold = True
        for ri, sale in enumerate(sales, start=1):
            row = sale_table.rows[ri]
            row.cells[0].text = str(sale.id)
            row.cells[1].text = sale.sale_number
            row.cells[2].text = sale.payment_method
            row.cells[3].text = sale.status
            row.cells[4].text = _fmt(sale.total)

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
