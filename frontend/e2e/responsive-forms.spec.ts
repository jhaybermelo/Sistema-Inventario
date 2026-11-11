import { test, expect } from '@playwright/test';
import { loginAs, expectAppRendered, expectNoHorizontalOverflow, expectControlsInsideViewport } from './helpers';

const routes = [
  ['/dashboard', 'Dashboard'],
  ['/inventario', 'Inventario'],
  ['/inventario/nuevo', 'Formulario de producto'],
  ['/pos', 'Punto de venta'],
  ['/ventas', 'Historial de ventas'],
  ['/clientes', 'Clientes'],
  ['/compras', 'Compras'],
  ['/caja', 'Caja'],
  ['/usuarios', 'Usuarios'],
  ['/configuracion', 'Configuración'],
] as const;

for (const [path, name] of routes) {
  test(`${name} (${path}) no desborda y sus controles caben en pantalla`, async ({ page }) => {
    await loginAs(page);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expectAppRendered(page);
    await expectNoHorizontalOverflow(page);
    await expectControlsInsideViewport(page);
  });
}

test('formulario de producto: validación visible y sin desborde en móvil', async ({ page }) => {
  await loginAs(page);
  await page.goto('/inventario/nuevo');
  await page.getByRole('button', { name: 'Crear producto' }).first().click();
  await expect(page.getByText(/requerid|obligatori|ingresa|mínimo|inválid|invalid|expected/i).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
