"""
Run once to create the initial admin user, business config, and default categories.
Usage: python seed.py
"""
import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal, engine, Base
from app.models.user import User
from app.models.business_config import BusinessConfig
from app.models.category import Category
from app.core.security import hash_password

DEFAULT_CATEGORIES = [
    # Categorías generales
    {"name": "General", "description": "Productos de uso general"},
    # Farmacia / Droguería
    {"name": "Medicamentos", "description": "Medicamentos de venta libre y formulados"},
    {"name": "Vitaminas y Suplementos", "description": "Vitaminas, minerales y suplementos nutricionales"},
    {"name": "Cuidado Personal", "description": "Higiene y cuidado del cuerpo"},
    {"name": "Bebé y Maternidad", "description": "Productos para bebés y madres gestantes"},
    {"name": "Dispositivos Médicos", "description": "Termómetros, tensiómetros, oxímetros, etc."},
    # Heladería
    {"name": "Helados", "description": "Helados en cono, copa y paleta"},
    {"name": "Bebidas Frías", "description": "Malteadas, batidos y bebidas heladas"},
    {"name": "Postres", "description": "Tortas, pasteles y postres"},
    {"name": "Ingredientes", "description": "Toppings, salsas y ingredientes para preparación"},
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:

        # Admin user
        result = await db.execute(select(User).where(User.username == "admin"))
        if not result.scalar_one_or_none():
            admin = User(
                username="admin",
                email="admin@example.com",
                full_name="Administrador",
                role="admin",
                hashed_password=hash_password("admin123"),
            )
            db.add(admin)
            print("✓ Admin creado: usuario=admin, contraseña=admin123")
        else:
            print("✓ Admin ya existe")

        # Business config
        config_result = await db.execute(select(BusinessConfig).limit(1))
        if not config_result.scalar_one_or_none():
            config = BusinessConfig(
                business_name="Mi Negocio",
                business_type="general",
                currency_symbol="$",
                tax_rate=0,
            )
            db.add(config)
            print("✓ Configuración inicial creada")
        else:
            print("✓ Configuración ya existe")

        # Default categories
        created = 0
        for cat_data in DEFAULT_CATEGORIES:
            exists = await db.execute(select(Category).where(Category.name == cat_data["name"]))
            if not exists.scalar_one_or_none():
                db.add(Category(**cat_data))
                created += 1

        if created:
            print(f"✓ {created} categorías predeterminadas creadas")
        else:
            print("✓ Categorías ya existen")

        await db.commit()
    print("\nSeed completado. Cambia la contraseña del admin en producción.")


if __name__ == "__main__":
    asyncio.run(seed())
