# Backend-Inventario

API REST del sistema de facturación e inventario. Construida con **FastAPI**, **SQLAlchemy (async)** y **PostgreSQL**.

El frontend vive en un repositorio aparte: [Frontend-Inventario](https://github.com/jhaybermelo/Frontend-Inventario).

## Funcionalidades

- Autenticación con JWT y roles (`admin`, `cashier`)
- Usuarios, productos y categorías (con importación por CSV)
- Ventas, clientes y créditos
- Compras a proveedores
- Caja (apertura y cierre de sesión de caja)
- Reportes en PDF y Word
- Notificaciones por correo (Gmail SMTP) y WhatsApp (CallMeBot)
- Configuración del negocio y logo

## Requisitos

- Python 3.12+
- Docker Desktop (para PostgreSQL), o PostgreSQL 15 instalado

## Variables de entorno

Copia `.env.example` a `.env` y ajusta los valores:

```powershell
copy .env.example .env
```

| Variable | Descripción |
|---|---|
| `DB_USER`, `DB_PASSWORD` | Credenciales de PostgreSQL (las usa Docker Compose) |
| `DATABASE_URL` | Cadena de conexión. Host `postgres-db` en Docker, `localhost` fuera de Docker |
| `SECRET_KEY` | Clave para firmar los JWT. Mínimo 32 caracteres; la app no arranca con una débil |
| `ACCESS_TOKEN_EXPIRE_HOURS` | Duración del token (por defecto 8) |
| `CORS_ORIGINS` | Lista JSON de orígenes permitidos |
| `SMTP_*`, `CALLMEBOT_APIKEY` | Opcionales, para notificaciones |

Genera una `SECRET_KEY` con:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

## Ejecución con Docker

Levanta PostgreSQL y la API:

```powershell
docker compose up -d --build
```

Esto crea la red `facturacion-net`, a la que se une el frontend. Levanta siempre el backend primero.

## Ejecución local (sin Docker para la API)

```powershell
docker compose up -d postgres-db      # solo la base de datos

python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

alembic upgrade head                  # migraciones
python seed.py                        # usuario administrador inicial
uvicorn app.main:app --reload --port 8000
```

En este modo, `DATABASE_URL` debe apuntar a `localhost`.

- API: http://localhost:8000/api
- Documentación interactiva (Swagger): http://localhost:8000/docs

El usuario inicial lo crea [seed.py](seed.py). **Cambia su contraseña en cuanto inicies sesión.**

## Estructura

```
app/
  core/          seguridad, dependencias de auth, límite de intentos, logging
  models/        modelos SQLAlchemy
  schemas/       esquemas Pydantic
  routers/       endpoints (/api/auth, /api/products, /api/sales, ...)
  repositories/  acceso a datos
  services/      lógica de negocio (ventas, reportes, notificaciones, CSV)
alembic/         migraciones
seed.py          datos iniciales
```

## Seguridad

- Contraseñas con bcrypt; política mínima de 8 caracteres con letras y números
- Login limitado a 5 intentos fallidos cada 15 minutos por IP y usuario (en memoria)
- Subida de logo validada por tipo, firma del archivo y tamaño (2 MB)
- Rutas protegidas por JWT; las de administración exigen rol `admin`

## Pruebas

```powershell
pytest
```
