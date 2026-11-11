import { test, expect } from '@playwright/test';
import { loginAs, expectNoHorizontalOverflow, expectControlsInsideViewport } from './helpers';

const listPages = [
  ['/inventario', 'Inventario'],
  ['/ventas', 'Historial de ventas'],
  ['/compras', 'Compras'],
  ['/usuarios', 'Usuarios'],
  ['/notificaciones', 'Notificaciones'],
] as const;

for (const [path, name] of listPages) {
  test(`${name}: tarjetas en móvil, tabla en escritorio, sin scroll lateral`, async ({ page }) => {
    await loginAs(page);
    await page.goto(path);
    const table = page.locator('table.table-cards');
    await expect(table).toBeVisible();

    const isMobile = (page.viewportSize()?.width ?? 0) < 768;
    await expect(table.locator('thead')).toBeVisible({ visible: !isMobile });

    if (isMobile) {
      // Ningún contenedor de la tabla debe tener scroll horizontal propio.
      const scrolls = await table.evaluate((t) => {
        for (let el: HTMLElement | null = t; el && el !== document.body; el = el.parentElement) {
          if (el.scrollWidth > el.clientWidth + 1) return true;
        }
        return false;
      });
      expect(scrolls, 'la tabla aún necesita scroll horizontal en móvil').toBe(false);
    }
    await expectNoHorizontalOverflow(page);
    await expectControlsInsideViewport(page);
  });
}

test('Caja: historial en tarjetas en móvil', async ({ page }) => {
  await loginAs(page);
  await page.goto('/caja');
  await page.getByRole('button', { name: /historial/i }).click();
  const table = page.locator('table.table-cards');
  await expect(table).toBeVisible();
  const isMobile = (page.viewportSize()?.width ?? 0) < 768;
  await expect(table.locator('thead')).toBeVisible({ visible: !isMobile });
  await expectNoHorizontalOverflow(page);
});
