from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import os
from app.config import settings
from app.core.logging_config import setup_logging, get_logger
from app.routers import auth, users, products, sales, reports, config as config_router, notifications, cash, customers, credits, purchases

app_logger = get_logger("app", settings.LOG_DIR)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(settings.LOG_DIR)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    app_logger.info("[STARTUP] Sistema de Facturación iniciado correctamente")
    yield
    app_logger.info("[SHUTDOWN] Sistema de Facturación detenido")


app = FastAPI(
    title="Sistema de Facturación e Inventario",
    version="1.0.0",
    docs_url="/docs",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(sales.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(config_router.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(cash.router, prefix="/api")
app.include_router(customers.router, prefix="/api")
app.include_router(credits.router, prefix="/api")
app.include_router(purchases.router, prefix="/api")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    app_logger.error(
        "[UNHANDLED_ERROR] %s %s | error=%s: %s",
        request.method, request.url.path, type(exc).__name__, exc,
        exc_info=True,
    )
    return JSONResponse(status_code=500, content={"detail": "Error interno del servidor"})


@app.get("/health")
async def health():
    return {"status": "ok"}
