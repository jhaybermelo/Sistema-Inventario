import { expect, type Page } from '@playwright/test';

const user = {
  id: 1,
  username: 'admin',
  email: 'admin@example.com',
  full_name: 'Administrador',
  role: 'admin',
  is_active: true,
};

/** Simula la API para que las pruebas no dependan del backend ni de la BD. */
export async function mockApi(page: Page) {
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    const method = route.request().method();
    const page0 = { items: [], total: 0, pages: 1, page: 1, size: 20 };
    const today = new Date().toISOString().slice(0, 10);

    if (path === '/config/public') return json({ business_name: 'Mi Negocio', logo_url: null });
    if (path === '/auth/me') return json(user);
    if (path === '/auth/login') {
      const { password } = route.request().postDataJSON();
      // El backend real responde 401 con este detalle.
      return password === 'admin123'
        ? json({ access_token: 'fake-token', token_type: 'bearer' })
        : json({ detail: 'Usuario o contraseña incorrectos' }, 401);
    }
    if (path === '/reports/dashboard') {
      const day = { date: today, transaction_count: 0, total_revenue: '0', total_tax: '0' };
      return json({ today: day, week: [day], low_stock_count: 0 });
    }
    if (path === '/products/low-stock-count') return json({ count: 0 });
    if (path === '/cash/current') return json(null);
    if (['/products/categories', '/products/lookup'].includes(path)) return json([]);
    if (path === '/customers' && method === 'GET') {
      return json({
        ...page0,
        total: 2,
        items: [
          { id: 1, full_name: 'María Fernanda Rodríguez de la Hoz Castellanos', document_id: '1020304050', phone: '3001234567', email: 'maria.fernanda.rodriguez.castellanos@ejemplo-dominio-largo.com', is_active: true, total_purchases: 12, total_spent: '1523400.00' },
          { id: 2, full_name: 'Juan Pérez', document_id: null, phone: null, email: null, is_active: false, total_purchases: 0, total_spent: '0' },
        ],
      });
    }
    const list = (items: unknown[]) => json({ ...page0, items, total: items.length });
    const iso = new Date().toISOString();
    const LONG = 'Nombre muy largo de ejemplo para probar que el texto se ajusta en pantallas pequeñas';
    if (path === '/products' && method === 'GET') {
      return list([{ id: 1, name: LONG, sku: 'SKU-LARGO-0001', barcode: '7702001001234', description: null, price: '12500', cost: '8000', quantity: 3, low_stock_threshold: 5, category_id: 1, category: { id: 1, name: 'Bebidas', description: null }, is_active: true, attributes: null, created_at: iso, updated_at: iso, is_low_stock: true }]);
    }
    if (path === '/sales' && method === 'GET') {
      return list([{ id: 1, sale_number: 'F-0001', user_id: 1, customer_id: 1, customer_full_name: LONG, subtotal: '100', tax_amount: '0', discount_amount: '0', total: '1523400', paid_amount: '1523400', credit_amount: '0', payment_method: 'cash', status: 'completed', notes: null, created_at: iso, items: [] }]);
    }
    if (path === '/purchases' && method === 'GET') {
      return list([{ id: 1, purchase_number: 'C-0001', supplier_name: LONG, user_id: 1, total: '450000', status: 'confirmed', notes: null, created_at: iso, items: [{ id: 1, product_name: 'X', product_sku: 'X', quantity: 4, unit_cost: '1', line_total: '4' }] }]);
    }
    if (path === '/users' && method === 'GET') return json([{ ...user, id: 2, full_name: LONG, username: 'cajero_con_usuario_largo', email: 'cajero.con.correo.muy.largo@ejemplo-de-dominio.com', role: 'cashier' }]);
    if (path === '/cash/history') {
      return list([{ id: 1, user_id: 1, user_full_name: LONG, opening_amount: '50000', closing_amount: '120000', expected_amount: '118000', difference: '2000', status: 'closed', notes: null, opened_at: iso, closed_at: iso, expenses: [], cash_sales: '0', total_expenses: '0' }]);
    }
    if (path === '/notifications') {
      return list([{ id: 1, channel: 'email', status: 'failed', recipient: 'destinatario.con.correo.largo@ejemplo-de-dominio.com', message: LONG + ' ' + LONG, error: 'SMTPAuthenticationError: credenciales inválidas para el servidor de correo', created_at: iso }]);
    }
    if (path === '/config') return json({ business_name: 'Mi Negocio' });
    return json(method === 'GET' ? page0 : {});
  });
}

export async function loginAs(page: Page) {
  await page.addInitScript(() => localStorage.setItem('token', 'fake-token'));
  await mockApi(page);
}

/** Evita falsos positivos: una página en blanco no desborda, así que exige que React haya pintado algo. */
export async function expectAppRendered(page: Page) {
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.locator('input, button, h1, h2').first()).toBeVisible();
}

/** Falla si la página tiene scroll horizontal (síntoma típico de un layout no responsive). */
export async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, 'la página desborda horizontalmente').toBeLessThanOrEqual(clientWidth);
}

/** Todos los campos y botones visibles deben estar dentro del viewport horizontalmente. */
export async function expectControlsInsideViewport(page: Page) {
  const offenders = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    // Un control dentro de un contenedor con scroll horizontal propio (p. ej. una tabla) es legítimo.
    const inScroller = (el: HTMLElement) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) return true;
      }
      return false;
    };
    return [...document.querySelectorAll<HTMLElement>('input, select, textarea, button')]
      .filter((el) => el.offsetParent !== null && !inScroller(el))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.right > 0 && (r.left < -1 || r.right > vw + 1)) // r.right<=0: drawer cerrado a propósito
      .map(({ el, r }) => `${el.tagName.toLowerCase()}[${el.getAttribute('name') ?? el.textContent?.trim()}] ${Math.round(r.left)}→${Math.round(r.right)} (vw=${vw})`);
  });
  expect(offenders, 'controles fuera del viewport').toEqual([]);
}
