import { expect, test } from '@playwright/test';

async function expectNoPageOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(overflow.document, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.viewport + 1);
  expect(overflow.body, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.viewport + 1);
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('main.app')).toBeVisible();
});

test('home, Money, and Weather stay inside the viewport', async ({ page }) => {
  await expectNoPageOverflow(page);

  await page.locator('#open-money').click();
  await expect(page.locator('.money-app')).toBeVisible();
  await expectNoPageOverflow(page);

  const triggers = page.locator('.currency-picker-trigger');
  await expect(triggers).toHaveCount(2);
  await triggers.first().click();
  await expect(page.locator('.currency-picker')).toBeVisible();
  await page.locator('.currency-picker-search').fill('EUR');
  await expect(page.locator('.currency-picker-option')).toContainText(['EUR']);
  await expectNoPageOverflow(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.currency-picker')).toHaveCount(0);

  await page.locator('#back-from-money').click();
  await page.locator('#open-weather').click();
  await expect(page.locator('.weather-app')).toBeVisible();
  await expectNoPageOverflow(page);
});

test('Turkish rendering and currency decimal entry remain usable', async ({ page }) => {
  await page.locator('#lang').selectOption('tr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  await page.locator('#open-money').click();
  await page.locator('#money-amount').fill('0,125');
  await expect(page.locator('#money-invalid')).toBeHidden();
  await expectNoPageOverflow(page);
});

test('keyboard focus returns to the currency trigger after closing the picker', async ({ page }) => {
  await page.locator('#open-money').click();
  const trigger = page.locator('.currency-picker-trigger').first();
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.currency-picker-search')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});
