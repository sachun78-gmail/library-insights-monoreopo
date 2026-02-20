// Shared book detail modal logic
// Used by both search.astro and index.astro
// Includes integrated library search: GPS-based with region dropdown fallback

import { regions as regionsData } from '../data/regions.js';
import { getUserId } from './bookmarks';

const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='192' viewBox='0 0 128 192'%3E%3Crect fill='%23e2e8f0' width='128' height='192'/%3E%3Ctext x='50%25' y='45%25' font-family='Arial' font-size='48' fill='%2394a3b8' text-anchor='middle'%3E📚%3C/text%3E%3Ctext x='50%25' y='58%25' font-family='Arial' font-size='12' fill='%2394a3b8' text-anchor='middle'%3ENo Image%3C/text%3E%3C/svg%3E";

interface BookModalCallbacks {
  onOpen?: (book: any) => void;
  onClose?: () => void;
}

let _callbacks: BookModalCallbacks = {};
let _currentBook: any = null;

// GPS cache
let userLat: number | null = null;
let userLon: number | null = null;

// Region dropdown state
let modalSelectedRegion = '';
let modalSelectedSubRegion = '';

// Current mode: 'gps' | 'region'
let libraryMode: 'gps' | 'region' = 'gps';

function getEl(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return dateStr || '';
  return `${dateStr.slice(0, 4)}.${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)}`;
}

// ========================================
// AI Insight Section
// ========================================

let _aiProgressTimer: ReturnType<typeof setInterval> | null = null;

function resetAiInsightState(): void {
  stopAiProgress();
  getEl('ai-insight-btn')?.classList.remove('hidden');
  getEl('ai-insight-login')?.classList.add('hidden');
  getEl('ai-insight-loading')?.classList.add('hidden');
  getEl('ai-insight-content')?.classList.add('hidden');
  getEl('ai-insight-error')?.classList.add('hidden');
}

const AI_PROGRESS_STEPS = [
  { pct: 10, text: '도서 정보 수집 중...' },
  { pct: 25, text: 'AI 모델에 요청 중...' },
  { pct: 45, text: '도서 내용 분석 중...' },
  { pct: 60, text: '핵심 인사이트 추출 중...' },
  { pct: 75, text: '추천 대상 분석 중...' },
  { pct: 85, text: '난이도 평가 중...' },
  { pct: 92, text: '결과 정리 중...' },
];

function startAiProgress(): void {
  stopAiProgress();
  let stepIdx = 0;
  const bar = getEl('ai-insight-progress-bar') as HTMLElement | null;
  const pct = getEl('ai-insight-progress-percent');
  const txt = getEl('ai-insight-loading-text');
  if (bar) bar.style.width = '0%';
  if (pct) pct.textContent = '0%';
  if (txt) txt.textContent = AI_PROGRESS_STEPS[0].text;

  _aiProgressTimer = setInterval(() => {
    if (stepIdx >= AI_PROGRESS_STEPS.length) {
      stopAiProgress();
      return;
    }
    const step = AI_PROGRESS_STEPS[stepIdx];
    if (bar) bar.style.width = `${step.pct}%`;
    if (pct) pct.textContent = `${step.pct}%`;
    if (txt) txt.textContent = step.text;
    stepIdx++;
  }, 1200);
}

function stopAiProgress(): void {
  if (_aiProgressTimer) {
    clearInterval(_aiProgressTimer);
    _aiProgressTimer = null;
  }
}

function completeAiProgress(): Promise<void> {
  stopAiProgress();
  const bar = getEl('ai-insight-progress-bar') as HTMLElement | null;
  const pct = getEl('ai-insight-progress-percent');
  const txt = getEl('ai-insight-loading-text');
  if (bar) bar.style.width = '100%';
  if (pct) pct.textContent = '100%';
  if (txt) txt.textContent = '분석 완료!';
  return new Promise(resolve => setTimeout(resolve, 400));
}

async function fetchAiInsight(): Promise<void> {
  if (!_currentBook) return;

  const title = _currentBook.bookname || '';
  const author = _currentBook.authors || '';
  if (!title) return;

  getEl('ai-insight-btn')?.classList.add('hidden');
  getEl('ai-insight-login')?.classList.add('hidden');
  getEl('ai-insight-loading')?.classList.remove('hidden');
  getEl('ai-insight-content')?.classList.add('hidden');
  getEl('ai-insight-error')?.classList.add('hidden');

  startAiProgress();

  try {
    let apiUrl = `/api/book-ai-insight?title=${encodeURIComponent(title)}`;
    if (author) apiUrl += `&author=${encodeURIComponent(author)}`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.error || !data.success || !data.insight) {
      stopAiProgress();
      getEl('ai-insight-loading')?.classList.add('hidden');
      getEl('ai-insight-error')?.classList.remove('hidden');
      return;
    }

    const insight = data.insight;

    if (insight.raw) {
      const summaryEl = getEl('ai-insight-summary');
      if (summaryEl) summaryEl.textContent = insight.raw;
    } else {
      const summaryEl = getEl('ai-insight-summary');
      const keyMsgEl = getEl('ai-insight-key-message');
      const recommendEl = getEl('ai-insight-recommend');
      const difficultyEl = getEl('ai-insight-difficulty');

      if (summaryEl) summaryEl.textContent = insight.summary || '';
      if (keyMsgEl) keyMsgEl.textContent = insight.keyMessage || '';
      if (recommendEl) recommendEl.textContent = insight.recommendFor || '';
      if (difficultyEl) difficultyEl.textContent = insight.difficulty || '';
    }

    await completeAiProgress();
    getEl('ai-insight-loading')?.classList.add('hidden');
    getEl('ai-insight-content')?.classList.remove('hidden');
  } catch (error) {
    console.error('AI insight fetch error:', error);
    stopAiProgress();
    getEl('ai-insight-loading')?.classList.add('hidden');
    getEl('ai-insight-error')?.classList.remove('hidden');
  }
}

function handleAiInsightClick(): void {
  const userId = getUserId();
  if (!userId) {
    getEl('ai-insight-btn')?.classList.add('hidden');
    getEl('ai-insight-login')?.classList.remove('hidden');
    return;
  }
  fetchAiInsight();
}

// ========================================
// Review Section
// ========================================

function resetReviewState(): void {
  getEl('review-loading')?.classList.add('hidden');
  getEl('review-content')?.classList.add('hidden');
  getEl('review-empty')?.classList.add('hidden');
  getEl('book-price-info')?.classList.add('hidden');
  getEl('data4lib-intro')?.classList.add('hidden');
  getEl('blog-review')?.classList.add('hidden');
}

async function fetchData4LibIntro(isbn13: string): Promise<void> {
  const introEl = getEl('data4lib-intro');
  const descEl = getEl('data4lib-description');
  if (!isbn13 || !introEl || !descEl) return;

  try {
    const res = await fetch(`/api/book-intro?isbn13=${encodeURIComponent(isbn13)}`);
    const data = await res.json();
    const detail = data.response?.detail?.[0]?.book || data.response?.book;
    const description = detail?.description || '';

    if (description && description.trim()) {
      descEl.textContent = description;
      introEl.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Data4library intro error:', err);
  }
}

async function fetchBookDetails(isbn: string, title: string): Promise<void> {
  const reviewLoading = getEl('review-loading');
  const reviewContent = getEl('review-content');
  const reviewEmpty = getEl('review-empty');
  const blogReview = getEl('blog-review');
  const bookDescription = getEl('book-description');
  const bookPriceInfo = getEl('book-price-info');
  const bookPrice = getEl('book-price');
  const bookDiscount = getEl('book-discount');
  const naverReviewLink = getEl('naver-review-link') as HTMLAnchorElement | null;
  const reviewTitle = getEl('review-title');
  const reviewDescription = getEl('review-description');
  const reviewBlogger = getEl('review-blogger');
  const reviewDate = getEl('review-date');
  const reviewLink = getEl('review-link') as HTMLAnchorElement | null;

  reviewLoading?.classList.remove('hidden');
  reviewContent?.classList.add('hidden');
  reviewEmpty?.classList.add('hidden');
  blogReview?.classList.add('hidden');
  getEl('data4lib-intro')?.classList.add('hidden');

  try {
    let naverApiUrl = '/api/book-detail?';
    if (isbn) naverApiUrl += `isbn=${encodeURIComponent(isbn)}`;
    if (title) naverApiUrl += `${isbn ? '&' : ''}title=${encodeURIComponent(title)}`;

    const [naverResponse] = await Promise.all([
      fetch(naverApiUrl).then(r => r.json()).catch(() => null),
      fetchData4LibIntro(isbn)
    ]);

    const data = naverResponse;
    reviewLoading?.classList.add('hidden');

    if (data && data.success && data.book) {
      const bookData = data.book;

      if (data.review && blogReview) {
        const review = data.review;
        if (reviewTitle) reviewTitle.textContent = review.title;
        if (reviewDescription) reviewDescription.textContent = review.description;
        if (reviewBlogger) reviewBlogger.textContent = review.bloggerName;
        if (reviewDate) reviewDate.textContent = formatDate(review.postDate);
        if (reviewLink) reviewLink.href = review.link;
        blogReview.classList.remove('hidden');
      }

      const data4libVisible = !getEl('data4lib-intro')?.classList.contains('hidden');
      if (bookData.description && bookDescription && !data4libVisible) {
        const descP = bookDescription.querySelector('p');
        if (descP) {
          descP.textContent = bookData.description;
          bookDescription.classList.remove('hidden');
        }
      } else if (bookDescription) {
        bookDescription.classList.add('hidden');
      }

      if (bookData.price && bookData.discount) {
        bookPriceInfo?.classList.remove('hidden');
        if (bookPrice) bookPrice.textContent = `정가: ${parseInt(bookData.price).toLocaleString()}원`;
        if (bookDiscount) bookDiscount.textContent = `${parseInt(bookData.discount).toLocaleString()}원`;
      } else {
        bookPriceInfo?.classList.add('hidden');
      }

      if (naverReviewLink && title) {
        naverReviewLink.href = `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(title + ' 책 리뷰')}`;
      }

      reviewContent?.classList.remove('hidden');
    } else {
      if (naverReviewLink && title) {
        naverReviewLink.href = `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(title + ' 책 리뷰')}`;
        if (bookDescription) bookDescription.classList.add('hidden');
        bookPriceInfo?.classList.add('hidden');
        reviewContent?.classList.remove('hidden');
      } else {
        reviewEmpty?.classList.remove('hidden');
      }
    }
  } catch (error) {
    console.error('Book detail fetch error:', error);
    reviewLoading?.classList.add('hidden');
    if ((getEl('naver-review-link') as HTMLAnchorElement | null) && title) {
      const link = getEl('naver-review-link') as HTMLAnchorElement;
      link.href = `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(title + ' 책 리뷰')}`;
      if (bookDescription) bookDescription.classList.add('hidden');
      bookPriceInfo?.classList.add('hidden');
      blogReview?.classList.add('hidden');
      reviewContent?.classList.remove('hidden');
    } else {
      reviewEmpty?.classList.remove('hidden');
    }
  }
}

// ========================================
// GPS Utilities
// ========================================

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

function getUserLocation(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  });
}

const regionCenters = [
  { code: '11', name: '서울', lat: 37.5665, lon: 126.9780 },
  { code: '21', name: '부산', lat: 35.1796, lon: 129.0756 },
  { code: '22', name: '대구', lat: 35.8714, lon: 128.6014 },
  { code: '23', name: '인천', lat: 37.4563, lon: 126.7052 },
  { code: '24', name: '광주', lat: 35.1595, lon: 126.8526 },
  { code: '25', name: '대전', lat: 36.3504, lon: 127.3845 },
  { code: '26', name: '울산', lat: 35.5384, lon: 129.3114 },
  { code: '29', name: '세종', lat: 36.4800, lon: 127.0000 },
  { code: '31', name: '경기', lat: 37.4138, lon: 127.5183 },
  { code: '32', name: '강원', lat: 37.8228, lon: 128.1555 },
  { code: '33', name: '충북', lat: 36.6357, lon: 127.4917 },
  { code: '34', name: '충남', lat: 36.5184, lon: 126.8000 },
  { code: '35', name: '전북', lat: 35.8203, lon: 127.1089 },
  { code: '36', name: '전남', lat: 34.8161, lon: 126.4629 },
  { code: '37', name: '경북', lat: 36.4919, lon: 128.8889 },
  { code: '38', name: '경남', lat: 35.4606, lon: 128.2132 },
  { code: '39', name: '제주', lat: 33.4890, lon: 126.4983 },
];

function getNearestRegions(lat: number, lon: number, count = 2) {
  return regionCenters
    .map(r => ({ ...r, dist: haversineDistance(lat, lon, r.lat, r.lon) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, count);
}

// ========================================
// Library Section - Shared
// ========================================

function resetLibraryState(): void {
  // Show library section (will be hidden if no results)
  getEl('library-section')?.classList.remove('hidden');
  getEl('library-initial')?.classList.remove('hidden');
  getEl('library-empty')?.classList.add('hidden');
  getEl('library-loading')?.classList.add('hidden');
  getEl('library-location-error')?.classList.add('hidden');
  getEl('library-count')?.classList.add('hidden');
  getEl('library-gps-view')?.classList.add('hidden');
  getEl('library-region-view')?.classList.add('hidden');
  const libraryList = getEl('library-list');
  if (libraryList) libraryList.innerHTML = '';

  // Reset region dropdown
  modalSelectedRegion = '';
  modalSelectedSubRegion = '';
  const regionSelect = getEl('modal-region-select') as HTMLSelectElement | null;
  const subRegionSelect = getEl('modal-subregion-select') as HTMLSelectElement | null;
  if (regionSelect) regionSelect.value = '';
  if (subRegionSelect) {
    subRegionSelect.innerHTML = '<option value="">세부 지역</option>';
    subRegionSelect.disabled = true;
  }

  // Reset mode description
  const modeDesc = getEl('library-mode-desc');
  if (modeDesc) {
    modeDesc.innerHTML = '<span class="material-symbols-outlined text-xs sm:text-sm">info</span> 위치 정보를 확인하는 중...';
  }
}

function checkLoanAvailability(isbn: string, libs: Array<{ lib: any; distance?: number }>): void {
  const libraryList = getEl('library-list');
  if (!libraryList) return;

  libs.forEach(async ({ lib }) => {
    const card = libraryList.querySelector(`[data-libcode="${lib.libCode}"]`);
    if (!card) return;
    const badge = card.querySelector('.loan-badge');
    if (!badge) return;
    try {
      const res = await fetch(`/api/book-exist?isbn=${isbn}&libCode=${lib.libCode}`);
      const result = await res.json();
      if (result.loanAvailable) {
        badge.className = 'loan-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
        badge.innerHTML = '<span class="material-symbols-outlined text-xs">check_circle</span> 대출가능';
      } else if (result.hasBook) {
        badge.className = 'loan-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
        badge.innerHTML = '<span class="material-symbols-outlined text-xs">cancel</span> 대출중';
      } else {
        badge.className = 'loan-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-charcoal/10 dark:bg-white/10 text-charcoal/50 dark:text-white/50';
        badge.innerHTML = '<span class="material-symbols-outlined text-xs">help</span> 확인불가';
      }
    } catch {
      badge.className = 'loan-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-charcoal/10 dark:bg-white/10 text-charcoal/50 dark:text-white/50';
      badge.innerHTML = '<span class="material-symbols-outlined text-xs">help</span> 확인불가';
    }
  });
}

function renderLibraryCard(lib: any, distanceText?: string): string {
  return `
    <div class="p-4 bg-charcoal/5 dark:bg-white/5 rounded-lg" data-libcode="${lib.libCode}">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <h4 class="font-bold text-charcoal dark:text-white">${lib.libName}</h4>
            ${distanceText ? `
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                <span class="material-symbols-outlined text-xs">near_me</span>
                ${distanceText}
              </span>
            ` : ''}
            <span class="loan-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-charcoal/10 dark:bg-white/10 text-charcoal/50 dark:text-white/50">
              <span class="material-symbols-outlined text-xs animate-spin">progress_activity</span>
              확인중
            </span>
          </div>
          <p class="text-sm text-charcoal/60 dark:text-white/60 mb-1">
            <span class="material-symbols-outlined text-sm align-middle">location_on</span>
            ${lib.address}
          </p>
          ${lib.tel ? `
            <p class="text-sm text-charcoal/60 dark:text-white/60">
              <span class="material-symbols-outlined text-sm align-middle">call</span>
              ${lib.tel}
            </p>
          ` : ''}
        </div>
        ${lib.homepage ? `
          <a href="${lib.homepage}" target="_blank" rel="noopener noreferrer"
             class="flex-shrink-0 px-3 py-1 text-sm bg-primary text-charcoal rounded-lg hover:bg-primary/90 transition-colors">
            홈페이지
          </a>
        ` : ''}
      </div>
    </div>
  `;
}

// ========================================
// GPS-based Library Search
// ========================================

async function searchLibrariesByGPS(): Promise<void> {
  if (!_currentBook) return;

  const isbn = _currentBook.isbn13 || _currentBook.isbn;
  if (!isbn) {
    getEl('library-section')?.classList.add('hidden');
    return;
  }

  const libraryLoading = getEl('library-loading');
  const libraryLoadingText = getEl('library-loading-text');
  const libraryList = getEl('library-list');
  const libraryCount = getEl('library-count');

  getEl('library-initial')?.classList.add('hidden');
  getEl('library-empty')?.classList.add('hidden');
  getEl('library-location-error')?.classList.add('hidden');
  libraryLoading?.classList.remove('hidden');
  libraryCount?.classList.add('hidden');
  if (libraryList) libraryList.innerHTML = '';

  // Get user location if not cached
  if (userLat === null || userLon === null) {
    if (libraryLoadingText) libraryLoadingText.textContent = '위치 정보를 가져오는 중...';
    try {
      const loc = await getUserLocation();
      userLat = loc.lat;
      userLon = loc.lon;
    } catch (err) {
      console.error('Geolocation error:', err);
      libraryLoading?.classList.add('hidden');
      getEl('library-location-error')?.classList.remove('hidden');
      return;
    }
  }

  if (libraryLoadingText) libraryLoadingText.textContent = '주변 소장 도서관을 검색하는 중...';

  try {
    const nearestRegions = getNearestRegions(userLat, userLon, 2);

    const responses = await Promise.all(
      nearestRegions.map(r =>
        fetch(`/api/library-by-book?isbn=${isbn}&region=${r.code}`)
          .then(res => res.json())
          .catch(() => ({ response: { libs: [] } }))
      )
    );

    libraryLoading?.classList.add('hidden');

    // Merge & deduplicate
    const seen = new Set<string>();
    const allLibs: any[] = [];
    for (const data of responses) {
      const libs = data.response?.libs || [];
      for (const item of libs) {
        if (!seen.has(item.lib.libCode)) {
          seen.add(item.lib.libCode);
          allLibs.push(item);
        }
      }
    }

    if (allLibs.length === 0) {
      getEl('library-section')?.classList.add('hidden');
      return;
    }

    // Calculate distance and sort
    const allWithDistance = allLibs.map((item) => {
      const lib = item.lib;
      const libLat = parseFloat(lib.latitude);
      const libLon = parseFloat(lib.longitude);
      let distance = Infinity;
      if (!isNaN(libLat) && !isNaN(libLon) && libLat !== 0 && libLon !== 0) {
        distance = haversineDistance(userLat!, userLon!, libLat, libLon);
      }
      return { lib, distance };
    }).sort((a, b) => a.distance - b.distance);

    // Expanding radius filter
    let radiusKm = 3;
    let libsWithDistance = allWithDistance.filter(r => r.distance <= radiusKm);
    while (libsWithDistance.length === 0 && radiusKm < 10) {
      radiusKm += 1;
      libsWithDistance = allWithDistance.filter(r => r.distance <= radiusKm);
    }

    if (libsWithDistance.length === 0) {
      getEl('library-section')?.classList.add('hidden');
      return;
    }

    if (libraryCount) {
      libraryCount.textContent = `반경 ${radiusKm}km 이내 ${libsWithDistance.length}개 소장 도서관 (가까운 순)`;
      libraryCount.classList.remove('hidden');
    }

    if (libraryList) {
      libraryList.innerHTML = libsWithDistance.map(({ lib, distance }) => {
        const distanceText = distance !== Infinity ? formatDistance(distance) : '';
        return renderLibraryCard(lib, distanceText);
      }).join('');
    }

    checkLoanAvailability(isbn, libsWithDistance);

  } catch (error) {
    getEl('library-loading')?.classList.add('hidden');
    getEl('library-section')?.classList.add('hidden');
    console.error('Library fetch error:', error);
  }
}

// ========================================
// Region-based Library Search
// ========================================

function updateSubRegions(regionCode: string): void {
  const subRegionSelect = getEl('modal-subregion-select') as HTMLSelectElement | null;
  if (!subRegionSelect) return;
  const region = regionsData.find((r: any) => r.code === regionCode);
  subRegionSelect.innerHTML = '<option value="">전체</option>';
  if (region && region.subRegions) {
    region.subRegions.forEach((sub: any) => {
      const option = document.createElement('option');
      option.value = sub.code;
      option.textContent = sub.name;
      subRegionSelect.appendChild(option);
    });
    subRegionSelect.disabled = false;
  } else {
    subRegionSelect.disabled = true;
  }
}

async function searchLibrariesByRegion(): Promise<void> {
  if (!_currentBook) return;
  const isbn = _currentBook.isbn13 || _currentBook.isbn;
  if (!isbn) {
    getEl('library-section')?.classList.add('hidden');
    return;
  }

  const libraryLoading = getEl('library-loading');
  const libraryList = getEl('library-list');
  const libraryCount = getEl('library-count');

  getEl('library-initial')?.classList.add('hidden');
  getEl('library-empty')?.classList.add('hidden');
  libraryLoading?.classList.remove('hidden');
  libraryCount?.classList.add('hidden');
  if (libraryList) libraryList.innerHTML = '';

  try {
    let apiUrl = `/api/library-by-book?isbn=${isbn}`;
    if (modalSelectedRegion) apiUrl += `&region=${modalSelectedRegion}`;
    if (modalSelectedSubRegion) apiUrl += `&dtl_region=${modalSelectedSubRegion}`;

    const response = await fetch(apiUrl);
    const data = await response.json();
    libraryLoading?.classList.add('hidden');

    const libs = data.response?.libs || [];
    if (libs.length === 0) {
      getEl('library-section')?.classList.add('hidden');
      return;
    }

    if (libraryCount) {
      libraryCount.textContent = `총 ${libs.length}개의 도서관에서 소장 중`;
      libraryCount.classList.remove('hidden');
    }

    if (libraryList) {
      libraryList.innerHTML = libs.map((item: any) => renderLibraryCard(item.lib)).join('');
    }

    checkLoanAvailability(isbn, libs.map((item: any) => ({ lib: item.lib })));

  } catch (error) {
    getEl('library-loading')?.classList.add('hidden');
    getEl('library-section')?.classList.add('hidden');
    console.error('Library fetch error:', error);
  }
}

// ========================================
// Mode Switching
// ========================================

function switchToGPSMode(): void {
  libraryMode = 'gps';
  getEl('library-gps-view')?.classList.remove('hidden');
  getEl('library-region-view')?.classList.add('hidden');
  const modeDesc = getEl('library-mode-desc');
  if (modeDesc) {
    modeDesc.innerHTML = '<span class="material-symbols-outlined text-xs sm:text-sm">my_location</span> 현재 위치를 기반으로 가까운 소장 도서관을 조회합니다.';
  }
}

function switchToRegionMode(): void {
  libraryMode = 'region';
  getEl('library-gps-view')?.classList.add('hidden');
  getEl('library-region-view')?.classList.remove('hidden');
  getEl('library-location-error')?.classList.add('hidden');
  getEl('library-loading')?.classList.add('hidden');
  getEl('library-empty')?.classList.add('hidden');
  getEl('library-count')?.classList.add('hidden');
  const libraryList = getEl('library-list');
  if (libraryList) libraryList.innerHTML = '';

  const modeDesc = getEl('library-mode-desc');
  if (modeDesc) {
    modeDesc.innerHTML = '<span class="material-symbols-outlined text-xs sm:text-sm">info</span> 지역별 도서 소장 도서관을 조회합니다.';
  }

  // Show initial state for region mode
  const initial = getEl('library-initial');
  if (initial) {
    initial.classList.remove('hidden');
    const icon = initial.querySelector('.material-symbols-outlined');
    const text = initial.querySelector('p');
    if (icon) icon.textContent = 'search';
    if (text) text.textContent = '지역을 선택하면 소장 도서관을 조회합니다.';
  }
}

// ========================================
// Auto Location Detection & Search
// ========================================

async function startLibrarySearch(): Promise<void> {
  if (!_currentBook) return;

  // Try GPS first
  switchToGPSMode();
  getEl('library-initial')?.classList.add('hidden');
  getEl('library-loading')?.classList.remove('hidden');
  const libraryLoadingText = getEl('library-loading-text');
  if (libraryLoadingText) libraryLoadingText.textContent = '위치 정보를 가져오는 중...';

  // If location was already cached, use GPS directly
  if (userLat !== null && userLon !== null) {
    searchLibrariesByGPS();
    return;
  }

  // Try to get location
  try {
    const loc = await getUserLocation();
    userLat = loc.lat;
    userLon = loc.lon;
    searchLibrariesByGPS();
  } catch {
    // Location denied/unavailable → hide library section
    getEl('library-loading')?.classList.add('hidden');
    getEl('library-section')?.classList.add('hidden');
  }
}

// ========================================
// Init & Public API
// ========================================

export function initBookModal(callbacks?: BookModalCallbacks): void {
  _callbacks = callbacks || {};

  const modal = getEl('book-modal');
  const closeBtn = getEl('close-modal');

  closeBtn?.addEventListener('click', () => closeBookModal());
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeBookModal();
  });

  // Region dropdown events
  const regionSelect = getEl('modal-region-select') as HTMLSelectElement | null;
  const subRegionSelect = getEl('modal-subregion-select') as HTMLSelectElement | null;

  regionSelect?.addEventListener('change', (e) => {
    modalSelectedRegion = (e.target as HTMLSelectElement).value;
    modalSelectedSubRegion = '';
    updateSubRegions(modalSelectedRegion);
    if (modalSelectedRegion) {
      getEl('library-initial')?.classList.add('hidden');
      searchLibrariesByRegion();
    } else {
      getEl('library-initial')?.classList.remove('hidden');
      getEl('library-empty')?.classList.add('hidden');
      getEl('library-loading')?.classList.add('hidden');
      getEl('library-count')?.classList.add('hidden');
      const libraryList = getEl('library-list');
      if (libraryList) libraryList.innerHTML = '';
    }
  });

  subRegionSelect?.addEventListener('change', (e) => {
    modalSelectedSubRegion = (e.target as HTMLSelectElement).value;
    if (modalSelectedRegion) {
      searchLibrariesByRegion();
    }
  });

  // Retry location button
  getEl('retry-location-btn')?.addEventListener('click', () => {
    getEl('library-location-error')?.classList.add('hidden');
    userLat = null;
    userLon = null;
    startLibrarySearch();
  });

  // Switch to region mode button
  getEl('switch-to-region-btn')?.addEventListener('click', () => {
    switchToRegionMode();
  });

  // AI Insight button
  getEl('ai-insight-btn')?.addEventListener('click', () => {
    handleAiInsightClick();
  });

  // AI Insight login button — trigger main sign-in
  getEl('ai-insight-login-btn')?.addEventListener('click', () => {
    const signinBtn = document.getElementById('signin-btn');
    signinBtn?.click();
  });

  // AI Insight retry button
  getEl('ai-insight-retry-btn')?.addEventListener('click', () => {
    fetchAiInsight();
  });
}

export function openBookModal(book: any): void {
  if (!book) return;

  _currentBook = book;

  const modal = getEl('book-modal');
  const modalBookImage = getEl('modal-book-image') as HTMLImageElement | null;
  const modalBookTitle = getEl('modal-book-title');
  const modalBookAuthor = getEl('modal-book-author');
  const modalBookPublisher = getEl('modal-book-publisher');
  const modalBookTags = getEl('modal-book-tags');

  if (modalBookImage) {
    const hasImage = book.bookImageURL && book.bookImageURL.trim() !== '';
    modalBookImage.src = hasImage ? book.bookImageURL : PLACEHOLDER;
    modalBookImage.onerror = () => { modalBookImage.src = PLACEHOLDER; };
  }
  if (modalBookTitle) modalBookTitle.textContent = book.bookname;
  if (modalBookAuthor) modalBookAuthor.textContent = book.authors || '저자 미상';
  if (modalBookPublisher) {
    modalBookPublisher.textContent = `${book.publisher || ''} ${book.publication_year ? `(${book.publication_year})` : ''}`;
  }

  if (modalBookTags) {
    modalBookTags.innerHTML = '';
    if (book.class_nm) {
      modalBookTags.innerHTML += `<span class="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">${book.class_nm}</span>`;
    }
    if (book.isbn13) {
      modalBookTags.innerHTML += `<span class="text-xs px-2 py-1 bg-charcoal/5 dark:bg-white/10 text-charcoal/60 dark:text-white/60 rounded-full">ISBN: ${book.isbn13}</span>`;
    }
  }

  resetAiInsightState();
  resetReviewState();
  resetLibraryState();
  _callbacks.onOpen?.(book);

  modal?.classList.remove('hidden');
  fetchBookDetails(book.isbn13 || '', book.bookname || '');

  // Auto-start library search with GPS/region fallback
  startLibrarySearch();
}

export function closeBookModal(): void {
  getEl('book-modal')?.classList.add('hidden');
  resetAiInsightState();
  resetReviewState();
  resetLibraryState();
  _currentBook = null;
  _callbacks.onClose?.();
}
