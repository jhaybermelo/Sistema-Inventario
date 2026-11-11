import pandas as pd
import io
from decimal import Decimal, InvalidOperation
from typing import Any


REQUIRED_COLUMNS = {"name", "sku", "price"}
OPTIONAL_COLUMNS = {"barcode", "description", "cost", "quantity", "low_stock_threshold", "category_id"}


def parse_csv(content: bytes) -> dict[str, Any]:
    try:
        df = pd.read_csv(io.BytesIO(content), dtype=str)
    except Exception as e:
        return {"valid_rows": [], "error_rows": [{"row": 0, "error": f"No se pudo leer el archivo CSV: {e}"}], "total": 0}

    df.columns = [c.strip().lower() for c in df.columns]
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        return {
            "valid_rows": [],
            "error_rows": [{"row": 0, "error": f"Columnas requeridas faltantes: {', '.join(missing)}"}],
            "total": 0,
        }

    valid_rows = []
    error_rows = []

    for idx, row in df.iterrows():
        row_num = idx + 2  # 1-indexed + header row
        errors = []
        cleaned = {}

        name = str(row.get("name", "")).strip()
        if not name:
            errors.append("'name' es requerido")
        else:
            cleaned["name"] = name

        sku = str(row.get("sku", "")).strip()
        if not sku:
            errors.append("'sku' es requerido")
        else:
            cleaned["sku"] = sku

        try:
            cleaned["price"] = str(Decimal(str(row.get("price", "")).strip()))
        except (InvalidOperation, ValueError):
            errors.append(f"'price' debe ser un número válido: {row.get('price')}")

        if "cost" in df.columns and str(row.get("cost", "")).strip():
            try:
                cleaned["cost"] = str(Decimal(str(row["cost"]).strip()))
            except (InvalidOperation, ValueError):
                errors.append(f"'cost' debe ser un número: {row.get('cost')}")

        if "quantity" in df.columns and str(row.get("quantity", "")).strip():
            try:
                cleaned["quantity"] = int(str(row["quantity"]).strip())
            except ValueError:
                errors.append(f"'quantity' debe ser entero: {row.get('quantity')}")
        else:
            cleaned["quantity"] = 0

        for col in ("barcode", "description"):
            if col in df.columns and str(row.get(col, "")).strip():
                cleaned[col] = str(row[col]).strip()

        if errors:
            error_rows.append({"row": row_num, "data": row.to_dict(), "errors": errors})
        else:
            valid_rows.append(cleaned)

    return {"valid_rows": valid_rows, "error_rows": error_rows, "total": len(df)}
