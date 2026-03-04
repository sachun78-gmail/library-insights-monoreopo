import { test, expect } from '@playwright/test';

test.describe('홈 페이지', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('페이지 타이틀이 표시된다', async ({ page }) => {
    await expect(page).toHaveTitle(/LibraryInsights/i);
  });

  test('헤더 로고가 표시된다', async ({ page }) => {
    await expect(page.locator('a[href="/"] span').filter({ hasText: 'LibraryInsights' })).toBeVisible();
  });

  test('네비게이션 메뉴가 표시된다', async ({ page }) => {
    // 데스크톱 nav는 hidden md:flex이므로 데스크톱 뷰포트 강제 적용
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator('a[href="/bestsellers"]').first()).toBeVisible();
    await expect(page.locator('a[href="/reviews"]').first()).toBeVisible();
  });

  test('검색 입력창이 표시된다', async ({ page }) => {
    await expect(page.locator('#search-input')).toBeVisible();
  });

  test('검색 타입 탭이 표시된다', async ({ page }) => {
    await expect(page.locator('#type-title-btn')).toBeVisible();
    await expect(page.locator('#type-author-btn')).toBeVisible();
  });

  test('오늘의 추천 도서 섹션이 표시된다', async ({ page }) => {
    // h2 태그만 한정 (text= 셀렉터는 h2, p 등 여러 요소에 매칭될 수 있음)
    await expect(page.locator('h2').filter({ hasText: '오늘의 추천 도서' })).toBeVisible();
  });

  test('검색어 입력 후 검색 페이지로 이동한다', async ({ page }) => {
    await page.locator('#search-input').fill('파친코');
    await page.locator('#search-input').press('Enter');
    await expect(page).toHaveURL(/\/search\?/);
  });
});
