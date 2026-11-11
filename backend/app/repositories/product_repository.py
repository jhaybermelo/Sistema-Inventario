from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, asc, desc
from sqlalchemy.orm import selectinload
from app.models.product import Product
from app.models.category import Category
from app.schemas.product import ProductCreate, ProductUpdate
from typing import Optional


class ProductRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, product_id: int) -> Optional[Product]:
        result = await self.db.execute(
            select(Product).options(selectinload(Product.category)).where(Product.id == product_id)
        )
        return result.scalar_one_or_none()

    async def get_by_sku(self, sku: str) -> Optional[Product]:
        result = await self.db.execute(select(Product).where(Product.sku == sku))
        return result.scalar_one_or_none()

    async def get_by_barcode(self, barcode: str) -> Optional[Product]:
        result = await self.db.execute(select(Product).where(Product.barcode == barcode))
        return result.scalar_one_or_none()

    async def search(
        self,
        query: Optional[str] = None,
        category_id: Optional[int] = None,
        low_stock_only: bool = False,
        is_active: Optional[bool] = True,
        page: int = 1,
        size: int = 20,
        sort_by: str = "name",
        sort_dir: str = "asc",
    ) -> tuple[list[Product], int]:
        stmt = select(Product).options(selectinload(Product.category))

        if is_active is not None:
            stmt = stmt.where(Product.is_active == is_active)
        if category_id:
            stmt = stmt.where(Product.category_id == category_id)
        if low_stock_only:
            stmt = stmt.where(Product.quantity <= Product.low_stock_threshold)
        if query:
            q = f"%{query}%"
            stmt = stmt.where(
                or_(
                    Product.name.ilike(q),
                    Product.sku.ilike(q),
                    Product.barcode.ilike(q),
                )
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        sort_col = {
            "name":     Product.name,
            "sku":      Product.sku,
            "price":    Product.price,
            "quantity": Product.quantity,
            "created_at": Product.created_at,
        }.get(sort_by, Product.name)
        direction = desc if sort_dir == "desc" else asc
        stmt = stmt.order_by(direction(sort_col), Product.name)
        stmt = stmt.offset((page - 1) * size).limit(size)
        result = await self.db.execute(stmt)
        return result.scalars().all(), total

    async def lookup(self, query: str) -> list[Product]:
        """Fast lookup for POS: matches name, SKU, or barcode."""
        q = f"%{query}%"
        result = await self.db.execute(
            select(Product)
            .options(selectinload(Product.category))
            .where(
                Product.is_active == True,
                Product.quantity > 0,
                or_(
                    Product.name.ilike(q),
                    Product.sku.ilike(q),
                    Product.barcode == query,
                ),
            )
            .limit(10)
        )
        return result.scalars().all()

    async def create(self, data: ProductCreate) -> Product:
        product = Product(**data.model_dump())
        self.db.add(product)
        await self.db.flush()
        await self.db.refresh(product)
        return product

    async def update(self, product: Product, data: ProductUpdate) -> Product:
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(product, field, value)
        await self.db.flush()
        await self.db.refresh(product)
        return product

    async def count_low_stock(self) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(Product).where(
                Product.is_active == True,
                Product.quantity <= Product.low_stock_threshold,
            )
        )
        return result.scalar_one()
