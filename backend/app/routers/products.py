import math
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.models.product import Product
from app.models.category import Category
from app.core.dependencies import get_current_user, require_admin
from app.core.logging_config import get_logger
from app.repositories.product_repository import ProductRepository
from app.schemas.product import (
    ProductCreate, ProductUpdate, ProductResponse, ProductListResponse,
    CategoryCreate, CategoryUpdate, CategoryResponse, CSVImportPreview,
)
from app.services.csv_import_service import parse_csv
from app.config import settings

router = APIRouter(prefix="/products", tags=["products"])
logger = get_logger("inventory", settings.LOG_DIR)


# ── Categories ────────────────────────────────────────────────────────────────

@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Category).where(Category.is_active == True).order_by(Category.name))
    return result.scalars().all()


@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(data: CategoryCreate, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    cat = Category(**data.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.put("/categories/{cat_id}", response_model=CategoryResponse)
async def update_category(cat_id: int, data: CategoryUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    result = await db.execute(select(Category).where(Category.id == cat_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(cat, field, value)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.delete("/categories/{cat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(cat_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    result = await db.execute(select(Category).where(Category.id == cat_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    # Check if any products use this category
    product_check = await db.execute(select(Product).where(Product.category_id == cat_id, Product.is_active == True).limit(1))
    if product_check.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="No se puede eliminar una categoría con productos activos asignados")
    cat.is_active = False
    await db.commit()


# ── Product Lookup (POS) ───────────────────────────────────────────────────────

@router.get("/lookup", response_model=list[ProductResponse])
async def lookup_products(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = ProductRepository(db)
    products = await repo.lookup(q)
    items = [ProductResponse.from_orm_with_flags(p) for p in products]
    if current_user.role != 'admin':
        for item in items:
            item.cost = None
    return items


# ── Products CRUD ─────────────────────────────────────────────────────────────

@router.get("", response_model=ProductListResponse)
async def list_products(
    q: str | None = None,
    category_id: int | None = None,
    low_stock_only: bool = False,
    sort_by: str = Query(default="name", pattern="^(name|sku|price|quantity|created_at)$"),
    sort_dir: str = Query(default="asc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = ProductRepository(db)
    products, total = await repo.search(q, category_id, low_stock_only, True, page, size, sort_by, sort_dir)
    pages = math.ceil(total / size)
    items = [ProductResponse.from_orm_with_flags(p) for p in products]
    if current_user.role != 'admin':
        for item in items:
            item.cost = None
    return ProductListResponse(items=items, total=total, page=page, size=size, pages=pages)


@router.get("/low-stock-count")
async def low_stock_count(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    repo = ProductRepository(db)
    count = await repo.count_low_stock()
    return {"count": count}


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(product_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    repo = ProductRepository(db)
    product = await repo.get_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    item = ProductResponse.from_orm_with_flags(product)
    if current_user.role != 'admin':
        item.cost = None
    return item


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(data: ProductCreate, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    repo = ProductRepository(db)
    if await repo.get_by_sku(data.sku):
        raise HTTPException(status_code=400, detail=f"SKU '{data.sku}' ya existe")
    if data.barcode and await repo.get_by_barcode(data.barcode):
        raise HTTPException(status_code=400, detail=f"Código de barras '{data.barcode}' ya existe")
    product = await repo.create(data)
    await db.commit()
    await db.refresh(product)
    logger.info(
        "[PRODUCT_CREATED] sku=%s name=%r price=%s qty=%s category_id=%s",
        product.sku, product.name, product.price, product.quantity, product.category_id,
    )
    return ProductResponse.from_orm_with_flags(product)


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    data: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    repo = ProductRepository(db)
    product = await repo.get_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    changed = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    product = await repo.update(product, data)
    await db.commit()
    await db.refresh(product)
    logger.info("[PRODUCT_UPDATED] sku=%s fields=%s", product.sku, list(changed.keys()))
    return ProductResponse.from_orm_with_flags(product)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    repo = ProductRepository(db)
    product = await repo.get_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    product.is_active = False
    await db.commit()
    logger.warning("[PRODUCT_DEACTIVATED] sku=%s name=%r", product.sku, product.name)


# ── CSV Import ─────────────────────────────────────────────────────────────────

@router.post("/import/preview", response_model=CSVImportPreview)
async def csv_preview(
    file: UploadFile = File(...),
    _: User = Depends(require_admin),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos .csv")
    content = await file.read()
    result = parse_csv(content)
    return CSVImportPreview(**result)


@router.post("/import/confirm", status_code=status.HTTP_201_CREATED)
async def csv_confirm(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    content = await file.read()
    result = parse_csv(content)
    repo = ProductRepository(db)
    created = 0
    skipped = 0

    for row in result["valid_rows"]:
        if await repo.get_by_sku(row["sku"]):
            skipped += 1
            continue
        from app.schemas.product import ProductCreate
        await repo.create(ProductCreate(**row))
        created += 1

    await db.commit()
    logger.info(
        "[CSV_IMPORT] created=%s skipped=%s errors=%s file=%s",
        created, skipped, len(result["error_rows"]), file.filename,
    )
    return {"created": created, "skipped": skipped, "errors": len(result["error_rows"])}
