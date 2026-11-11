# Frontend-Inventario

Interfaz web del sistema de facturación e inventario. Construida con **React 19**, **TypeScript** y **Vite**.

Consume la API del repositorio [Backend-Inventario](https://github.com/jhaybermelo/Backend-Inventario).

## Funcionalidades

- Inicio de sesión y rutas protegidas
- Punto de venta (POS) con lector de código de barras (cámara o escáner)
- Inventario y formulario de productos
- Historial de ventas, clientes y créditos
- Compras y caja
- Reportes con gráficos y descarga de PDF/Word
- Usuarios, configuración del negocio y registro de notificaciones

## Tecnologías

React Router, TanStack Query, React Hook Form + Zod, Axios, Tailwind CSS 4, Chart.js, ZXing.

## Requisitos

- Node.js 22+
- El backend corriendo en `http://localhost:8000`

## Desarrollo

```powershell
npm install
npm run dev
```

Abre http://localhost:5173. El servidor de Vite redirige `/api` y `/uploads` a `http://localhost:8000` (ver [vite.config.ts](vite.config.ts)), así que en desarrollo no hay problemas de CORS.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Comprueba tipos y genera `dist/` |
| `npm run preview` | Sirve el build localmente |
| `npm run lint` | Ejecuta ESLint |

## Ejecución con Docker

Copia `.env.example` a `.env`. Las variables son:

| Variable | Descripción |
|---|---|
| `FRONTEND_PORT` | Puerto expuesto en tu máquina (por defecto 80) |
| `BACKEND_URL` | Dirección a la que Nginx redirige `/api` y `/uploads` |

El frontend se une a la red Docker `facturacion-net`, que crea el `docker-compose.yml` del backend. **Levanta primero el backend**:

```powershell
docker compose up -d --build
```

Abre http://localhost. Para apuntar a otro backend, cambia `BACKEND_URL` y vuelve a levantar; no hace falta tocar el código.

## Estructura

```
src/
  api/          cliente Axios y un módulo por recurso
  components/   Layout, ProtectedRoute y componentes de UI
  context/      AuthContext (sesión)
  hooks/        useBarcodeScanner
  pages/        pantallas de la aplicación
  types/        tipos TypeScript
nginx/          plantilla de Nginx usada en Docker
```
