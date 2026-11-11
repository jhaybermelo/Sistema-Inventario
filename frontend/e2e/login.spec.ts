import { test, expect } from '@playwright/test';
import { mockApi, expectNoHorizontalOverflow, expectControlsInsideViewport } from './helpers';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await page.goto('/login');
});

test('el login es responsive', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectControlsInsideViewport(page);
});

test('muestra errores de validación con campos vacíos', async ({ page }) => {
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByText('Ingresa tu usuario')).toBeVisible();
  await expect(page.getByText('Ingresa tu contraseña')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('credenciales incorrectas muestran el mensaje de error', async ({ page }) => {
  await page.getByLabel('Usuario').fill('admin');
  await page.getByLabel('Contraseña').fill('mala');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByText('Usuario o contraseña incorrectos')).toBeVisible();
});

test('login correcto redirige al dashboard', async ({ page }) => {
  await page.getByLabel('Usuario').fill('admin');
  await page.getByLabel('Contraseña').fill('admin123');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});
