import { test, expect } from '@playwright/test';

test.describe('검색 페이지', () => {
  test('검색 결과 페이지가 로드된다', async ({ page }) => {
    await page.goto('/search?q=파친코&type=title');
    await expect(page.locator('#hero-title')).toBeVisible();
  });

  test('헤더 검색창이 표시된다', async ({ page }) => {
    // header-search-input은 hidden md:flex 내에 있어 데스크톱에서만 표시됨
    // /search?q=... 로 접근해야 search.astro가 정상 렌더링됨
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/search?q=test&type=title');
    await expect(page.locator('#header-search-input')).toBeVisible();
  });

  test('검색 결과에 도서가 표시된다', async ({ page }) => {
    await page.goto('/search?q=파친코&type=title');
    await page.waitForLoadState('networkidle');

    // #search-results의 직접 자식 div가 도서 카드
    const bookCards = page.locator('#search-results > div');
    await expect(bookCards.first()).toBeVisible({ timeout: 15_000 });
  });

  test('헤더 검색창에서 검색 시 결과 페이지로 이동한다', async ({ page }) => {
    // header-search-input은 hidden md:flex 내에 있어 데스크톱에서만 표시됨
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/search?q=test&type=title');
    await page.locator('#header-search-input').fill('소년이 온다');
    await page.locator('#header-search-input').press('Enter');
    await expect(page).toHaveURL(/q=/);
  });
});
