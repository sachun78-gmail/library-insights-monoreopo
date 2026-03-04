import { test, expect } from '@playwright/test';

test.describe('베스트셀러 페이지', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/bestsellers');
  });

  test('페이지 제목이 표시된다', async ({ page }) => {
    await expect(page.locator('h1').filter({ hasText: '인기 도서' })).toBeVisible();
  });

  test('인기도서 / 급상승 탭이 표시된다', async ({ page }) => {
    await expect(page.locator('#tab-popular')).toBeVisible();
    await expect(page.locator('#tab-hottrend')).toBeVisible();
  });

  test('필터 셀렉트박스가 표시된다', async ({ page }) => {
    await expect(page.locator('#popular-region')).toBeVisible();
    await expect(page.locator('#popular-age')).toBeVisible();
    await expect(page.locator('#popular-gender')).toBeVisible();
  });

  test('검색 버튼이 표시된다', async ({ page }) => {
    await expect(page.locator('#popular-search-btn')).toBeVisible();
  });

  test('도서 목록이 표시된다', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const bookList = page.locator('#content-popular');
    await expect(bookList).toBeVisible({ timeout: 15_000 });
  });

  test('급상승 탭 클릭 시 콘텐츠가 전환된다', async ({ page }) => {
    await page.locator('#tab-hottrend').click();
    await expect(page.locator('#tab-hottrend')).toHaveClass(/active|border-primary/);
  });
});
