import { test, expect } from '@playwright/test';
import { loginAs, expectNoHorizontalOverflow, expectControlsInsideViewport } from './helpers';

test('clientes: tarjetas en móvil, tabla en escritorio', async ({ page }) => {
  await loginAs(page);
  await page.goto('/clientes');
  await expect(page.locator('text=María Fernanda >> visible=true').first()).toBeVisible();

  const isMobile = (page.viewportSize()?.width ?? 0) < 768;
  if (isMobile) {
    await expect(page.locator('table')).toBeHidden();
    await expect(page.locator('text=$1.523 >> visible=true').first()).toBeVisible();
  } else {
    await expect(page.locator('table')).toBeVisible();
  }
  await expectNoHorizontalOverflow(page);
  await expectControlsInsideViewport(page);
});

test('clientes (móvil): abrir el detalle desde la tarjeta no rompe el layout', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 768, 'solo móvil');
  await loginAs(page);
  await page.goto('/clientes');
  await page.locator('text=Juan Pérez >> visible=true').click();
  await expectNoHorizontalOverflow(page);
});
