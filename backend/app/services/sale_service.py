from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from decimal import Decimal
import asyncio
from app.models.product import Product
from app.models.sale import Sale
from app.models.sale_item import SaleItem
from app.models.business_config import BusinessConfig
from app.models.customer_credit import CustomerCredit
from app.repositories.sale_repository import SaleRepository
from app.schemas.sale import SaleCreate
from app.services.notification_service import send_low_stock_alerts
from app.core.logging_config import get_logger
from app.config import settings

logger = get_logger("sales", settings.LOG_DIR)


class SaleService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = SaleRepository(db)

    async def create_sale(self, data: SaleCreate, user_id: int) -> Sale:
        logger.debug("[SALE_START] user_id=%s items=%s payment=%s", user_id, len(data.items), data.payment_method)

        config_result = await self.db.execute(select(BusinessConfig).limit(1))
        config = config_result.scalar_one_or_none()
        tax_rate = config.tax_rate if config else Decimal("0")

        items_data = []
        subtotal = Decimal("0")

        for item_input in data.items:
            result = await self.db.execute(
                select(Product).where(Product.id == item_input.product_id, Product.is_active == True)
            )
            product = result.scalar_one_or_none()
            if not product:
                logger.warning("[SALE_FAIL] user_id=%s reason=product_not_found product_id=%s", user_id, item_input.product_id)
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Producto con ID {item_input.product_id} no encontrado",
                )
            if product.quantity < item_input.quantity:
                logger.warning(
                    "[STOCK_FAIL] sku=%s name=%r available=%s requested=%s user_id=%s",
                    product.sku, product.name, product.quantity, item_input.quantity, user_id,
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Stock insuficiente para '{product.name}'. Disponible: {product.quantity}",
                )

            line_total = (product.price * item_input.quantity) - item_input.discount
            subtotal += line_total
            items_data.append((product, item_input, line_total))

        tax_amount = (subtotal * tax_rate / 100).quantize(Decimal("0.01"))
        total = subtotal + tax_amount - data.discount_amount
        sale_number = await self.repo.generate_sale_number()

        paid = data.paid_amount if data.paid_amount is not None else total
        if paid < Decimal("0") or paid > total:
            raise HTTPException(status_code=400, detail="El monto pagado debe estar entre 0 y el total de la venta")
        credit_amount = total - paid
        if credit_amount > 0 and not data.customer_id:
            raise HTTPException(status_code=400, detail="Se requiere asociar un cliente para ventas a crédito")

        sale = Sale(
            sale_number=sale_number,
            user_id=user_id,
            customer_id=data.customer_id,
            subtotal=subtotal,
            tax_amount=tax_amount,
            discount_amount=data.discount_amount,
            total=total,
            paid_amount=paid,
            credit_amount=credit_amount,
            payment_method=data.payment_method,
            notes=data.notes,
        )
        self.db.add(sale)
        await self.db.flush()

        low_stock_products = []
        for product, item_input, line_total in items_data:
            sale_item = SaleItem(
                sale_id=sale.id,
                product_id=product.id,
                product_name=product.name,
                product_sku=product.sku,
                unit_price=product.price,
                unit_cost=product.cost,
                quantity=item_input.quantity,
                discount=item_input.discount,
                line_total=line_total,
            )
            self.db.add(sale_item)
            product.quantity -= item_input.quantity
            logger.debug(
                "[STOCK_DEDUCTED] sku=%s qty_sold=%s stock_remaining=%s",
                product.sku, item_input.quantity, product.quantity,
            )
            if config and config.low_stock_alert_enabled and product.quantity <= product.low_stock_threshold:
                low_stock_products.append({
                    "name": product.name,
                    "sku": product.sku,
                    "quantity": product.quantity,
                    "threshold": product.low_stock_threshold,
                })
                logger.warning(
                    "[STOCK_LOW] sku=%s name=%r stock=%s threshold=%s",
                    product.sku, product.name, product.quantity, product.low_stock_threshold,
                )

        # Create credit record if partial or zero payment
        if credit_amount > 0:
            credit = CustomerCredit(
                customer_id=data.customer_id,
                sale_id=sale.id,
                original_amount=credit_amount,
                paid_amount=Decimal("0"),
                status="pending",
            )
            self.db.add(credit)
            logger.info(
                "[CREDIT_CREATED] sale=%s customer_id=%s credit_amount=%s",
                sale_number, data.customer_id, credit_amount,
            )

        await self.db.commit()
        await self.db.refresh(sale)

        logger.info(
            "[SALE_CREATED] sale=%s total=%s paid=%s credit=%s payment=%s user_id=%s items=%s",
            sale.sale_number, sale.total, paid, credit_amount,
            sale.payment_method, user_id, len(items_data),
        )

        if low_stock_products and config:
            skus = [p["sku"] for p in low_stock_products]
            logger.info("[ALERT_TRIGGERED] low_stock_skus=%s", skus)
            asyncio.create_task(send_low_stock_alerts(
                products=low_stock_products,
                business_name=config.business_name,
                notify_email=config.notify_email,
                notify_whatsapp=config.notify_whatsapp,
                email_enabled=config.email_notifications_enabled,
                whatsapp_enabled=config.whatsapp_notifications_enabled,
            ))

        return sale

    async def cancel_sale(self, sale_id: int, cancelled_by: int | None = None) -> Sale:
        sale = await self.repo.get_by_id(sale_id)
        if not sale:
            logger.warning("[CANCEL_FAIL] sale_id=%s reason=not_found by=admin#%s", sale_id, cancelled_by)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venta no encontrada")
        if sale.status != "completed":
            logger.warning("[CANCEL_FAIL] sale=%s reason=not_completed status=%s", sale.sale_number, sale.status)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo se pueden cancelar ventas completadas")

        for item in sale.items:
            result = await self.db.execute(select(Product).where(Product.id == item.product_id))
            product = result.scalar_one_or_none()
            if product:
                product.quantity += item.quantity
                logger.debug("[STOCK_RESTORED] sku=%s qty_restored=%s", product.sku, item.quantity)

        sale.status = "cancelled"
        await self.db.commit()
        await self.db.refresh(sale)
        logger.warning(
            "[SALE_CANCELLED] sale=%s items=%s by=admin#%s",
            sale.sale_number, len(sale.items), cancelled_by,
        )
        return sale
