// Shared book detail modal logic
// Used by both search.astro and index.astro
// Includes integrated library search: GPS-based with region dropdown fallback

import { regions as regionsData } from '../data/regions.js';
import { getUserId, isBookmarked, toggleBookmark } from './bookmarks';
import { supabase } from '../lib/supabase';

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

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
  const isbn13 = _currentBook.isbn13 || '';
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
    if (isbn13) apiUrl += `&isbn13=${encodeURIComponent(isbn13)}`;

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

async function handleAiInsightClick(): Promise<void> {
  const token = await getAuthToken();
  if (!token) {
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
// User Reviews Section
// ========================================

let _currentUserRating = 0;

function makeDisplayName(userId: string): string {
  return '독자_' + userId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

function getLoginDisplayName(): string {
  // 데스크탑은 #profile-name, 모바일은 #mobile-profile-name에 이름이 세팅됨
  return (
    document.getElementById('profile-name')?.textContent?.trim() ||
    document.getElementById('mobile-profile-name')?.textContent?.trim() ||
    ''
  );
}

function starsHtml(rating: number, filled = true): string {
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="${i < rating ? 'text-yellow-400' : 'text-charcoal/20 dark:text-white/20'}">${i < rating && filled ? '★' : '☆'}</span>`
  ).join('');
}

const REVIEWS_PREVIEW = 3; // 모달에서 기본 표시 개수
let _allReviews: any[] = [];

function resetUserReviewsState(): void {
  _currentUserRating = 0;
  _allReviews = [];
  getEl('reviews-summary')?.classList.add('hidden');
  getEl('my-review-form')?.classList.add('hidden');
  getEl('my-review-login-prompt')?.classList.add('hidden');
  getEl('user-reviews-loading')?.classList.add('hidden');
  getEl('reviews-empty')?.classList.add('hidden');
  getEl('reviews-show-more')?.classList.add('hidden');
  getEl('reviews-all-link')?.classList.add('hidden');
  const reviewsList = getEl('reviews-list');
  if (reviewsList) reviewsList.innerHTML = '';
  const textarea = getEl('review-textarea') as HTMLTextAreaElement | null;
  if (textarea) textarea.value = '';
  const charCount = getEl('review-char-count');
  if (charCount) charCount.textContent = '0/100';
  const deleteBtn = getEl('review-delete-btn');
  deleteBtn?.classList.add('hidden');
  const submitBtn = getEl('review-submit-btn');
  if (submitBtn) submitBtn.textContent = '등록';
  renderStarSelector(0);
  const errEl = getEl('review-submit-error');
  errEl?.classList.add('hidden');
}

function renderStarSelector(rating: number): void {
  _currentUserRating = rating;
  const buttons = document.querySelectorAll('#star-selector .star-btn');
  buttons.forEach((btn, i) => {
    const el = btn as HTMLElement;
    if (i < rating) {
      el.classList.add('text-yellow-400');
      el.classList.remove('text-charcoal/20', 'dark:text-white/20');
    } else {
      el.classList.remove('text-yellow-400');
      el.classList.add('text-charcoal/20', 'dark:text-white/20');
    }
  });
}

function buildReviewCard(r: any, currentUserId: string | null): string {
  const isOwn = r.user_id === currentUserId;
  const displayName = r.display_name || makeDisplayName(r.user_id);
  const dateStr = new Date(r.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `
    <div class="p-3 rounded-lg ${isOwn ? 'bg-primary/5 border border-primary/20 dark:border-primary/30' : 'bg-charcoal/5 dark:bg-white/5 border border-charcoal/5 dark:border-white/5'}">
      <div class="flex items-center justify-between mb-1">
        <div class="flex items-center gap-1.5">
          ${isOwn ? '<span class="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded font-bold">나</span>' : ''}
          <span class="text-xs font-bold text-charcoal/70 dark:text-white/70">${displayName}</span>
          <span class="text-yellow-400 text-xs leading-none">${starsHtml(r.rating)}</span>
        </div>
        <span class="text-[10px] text-charcoal/40 dark:text-white/40">${dateStr}</span>
      </div>
      <p class="text-xs sm:text-sm text-charcoal/80 dark:text-white/80 leading-relaxed">${r.review_text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
    </div>
  `;
}

function renderReviewList(reviews: any[], expanded: boolean): void {
  const listEl = getEl('reviews-list');
  const showMoreBtn = getEl('reviews-show-more');
  const showMoreText = getEl('reviews-show-more-text');
  const allLinkEl = getEl('reviews-all-link');
  if (!listEl) return;

  const userId = getUserId();
  const visible = expanded ? reviews : reviews.slice(0, REVIEWS_PREVIEW);
  listEl.innerHTML = visible.map(r => buildReviewCard(r, userId)).join('');

  const hidden = reviews.length - REVIEWS_PREVIEW;
  if (!expanded && hidden > 0) {
    if (showMoreText) showMoreText.textContent = `${hidden}개 더 보기`;
    showMoreBtn?.classList.remove('hidden');
    allLinkEl?.classList.add('hidden');
  } else {
    showMoreBtn?.classList.add('hidden');
    // 전체 리뷰가 많으면 게시판 링크 노출
    if (reviews.length >= REVIEWS_PREVIEW) {
      allLinkEl?.classList.remove('hidden');
    }
  }
}

async function fetchBookReviews(isbn13: string): Promise<void> {
  const loadingEl = getEl('user-reviews-loading');
  const emptyEl = getEl('reviews-empty');
  const summaryEl = getEl('reviews-summary');

  loadingEl?.classList.remove('hidden');
  emptyEl?.classList.add('hidden');
  summaryEl?.classList.add('hidden');
  getEl('reviews-show-more')?.classList.add('hidden');
  getEl('reviews-all-link')?.classList.add('hidden');
  const listEl = getEl('reviews-list');
  if (listEl) listEl.innerHTML = '';

  try {
    const res = await fetch(`/api/book-reviews?isbn13=${encodeURIComponent(isbn13)}`);
    const data = await res.json();
    loadingEl?.classList.add('hidden');

    _allReviews = data.reviews || [];

    // 내 리뷰 폼 pre-fill
    const userId = getUserId();
    if (userId) {
      const myReview = _allReviews.find(r => r.user_id === userId);
      const textarea = getEl('review-textarea') as HTMLTextAreaElement | null;
      const deleteBtn = getEl('review-delete-btn');
      const submitBtn = getEl('review-submit-btn');
      if (myReview) {
        renderStarSelector(myReview.rating);
        if (textarea) textarea.value = myReview.review_text;
        const charCount = getEl('review-char-count');
        if (charCount) charCount.textContent = `${myReview.review_text.length}/100`;
        deleteBtn?.classList.remove('hidden');
        if (submitBtn) submitBtn.textContent = '수정';
      } else {
        deleteBtn?.classList.add('hidden');
        if (submitBtn) submitBtn.textContent = '등록';
      }
    }

    // 평균 별점 요약
    if (_allReviews.length > 0) {
      const avg = _allReviews.reduce((sum, r) => sum + r.rating, 0) / _allReviews.length;
      const avgStarsEl = getEl('reviews-avg-stars');
      const avgScoreEl = getEl('reviews-avg-score');
      const countTextEl = getEl('reviews-count-text');
      if (avgStarsEl) avgStarsEl.innerHTML = starsHtml(Math.round(avg));
      if (avgScoreEl) avgScoreEl.textContent = avg.toFixed(1);
      if (countTextEl) countTextEl.textContent = `(${_allReviews.length}개의 한줄평)`;
      summaryEl?.classList.remove('hidden');
    }

    if (_allReviews.length === 0) {
      emptyEl?.classList.remove('hidden');
    } else {
      renderReviewList(_allReviews, false);
    }
  } catch (err) {
    console.error('Review fetch error:', err);
    loadingEl?.classList.add('hidden');
    emptyEl?.classList.remove('hidden');
  }
}

async function submitReview(): Promise<void> {
  const userId = getUserId();
  if (!userId || !_currentBook) return;

  const textarea = getEl('review-textarea') as HTMLTextAreaElement | null;
  const reviewText = textarea?.value.trim() || '';
  const errEl = getEl('review-submit-error');

  if (_currentUserRating === 0) {
    if (errEl) { errEl.textContent = '별점을 선택해주세요.'; errEl.classList.remove('hidden'); }
    return;
  }
  if (reviewText.length === 0) {
    if (errEl) { errEl.textContent = '한줄평을 입력해주세요.'; errEl.classList.remove('hidden'); }
    return;
  }
  errEl?.classList.add('hidden');

  const submitBtn = getEl('review-submit-btn') as HTMLButtonElement | null;
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '저장 중...'; }

  const token = await getAuthToken();
  if (!token) {
    if (errEl) { errEl.textContent = '로그인이 필요합니다.'; errEl.classList.remove('hidden'); }
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '등록'; }
    return;
  }

  try {
    const res = await fetch('/api/book-reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        isbn13: _currentBook.isbn13 || '',
        bookname: _currentBook.bookname || '',
        authors: _currentBook.authors || '',
        publisher: _currentBook.publisher || '',
        book_image_url: _currentBook.bookImageURL || '',
        display_name: getLoginDisplayName(),
        rating: _currentUserRating,
        review_text: reviewText,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    // Reload reviews
    await fetchBookReviews(_currentBook.isbn13 || '');
  } catch (err: any) {
    console.error('Review submit error:', err);
    if (errEl) { errEl.textContent = '저장 중 오류가 발생했습니다.'; errEl.classList.remove('hidden'); }
  } finally {
    if (submitBtn) { submitBtn.disabled = false; }
  }
}

async function deleteReview(): Promise<void> {
  if (!_currentBook) return;

  const deleteBtn = getEl('review-delete-btn') as HTMLButtonElement | null;
  if (deleteBtn) { deleteBtn.disabled = true; deleteBtn.textContent = '삭제 중...'; }

  const token = await getAuthToken();
  if (!token) {
    if (deleteBtn) { deleteBtn.disabled = false; deleteBtn.textContent = '삭제'; }
    return;
  }

  try {
    const res = await fetch('/api/book-reviews', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isbn13: _currentBook.isbn13 || '' }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    // Reset form and reload
    const textarea = getEl('review-textarea') as HTMLTextAreaElement | null;
    if (textarea) textarea.value = '';
    const charCount = getEl('review-char-count');
    if (charCount) charCount.textContent = '0/100';
    renderStarSelector(0);
    deleteBtn?.classList.add('hidden');
    const submitBtn = getEl('review-submit-btn');
    if (submitBtn) submitBtn.textContent = '등록';
    await fetchBookReviews(_currentBook.isbn13 || '');
  } catch (err: any) {
    console.error('Review delete error:', err);
  } finally {
    if (deleteBtn) { deleteBtn.disabled = false; }
  }
}

function initReviewSection(): void {
  // Star selector buttons
  document.querySelectorAll('#star-selector .star-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const star = parseInt((btn as HTMLElement).dataset.star || '0', 10);
      renderStarSelector(star);
    });
  });

  // Textarea char count
  const textarea = getEl('review-textarea') as HTMLTextAreaElement | null;
  textarea?.addEventListener('input', () => {
    const charCount = getEl('review-char-count');
    if (charCount) charCount.textContent = `${textarea.value.length}/100`;
  });

  // Submit button
  getEl('review-submit-btn')?.addEventListener('click', () => {
    submitReview();
  });

  // Delete button
  getEl('review-delete-btn')?.addEventListener('click', () => {
    deleteReview();
  });

  // 더보기 버튼 — 전체 펼치기
  getEl('reviews-show-more')?.addEventListener('click', () => {
    renderReviewList(_allReviews, true);
  });

  // Login button in review section
  getEl('review-login-btn')?.addEventListener('click', () => {
    const signinBtn = document.getElementById('signin-btn');
    signinBtn?.click();
  });
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
  getEl('library-region-view')?.classList.remove('hidden');
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

    // GPS 매칭된 가장 가까운 지역을 드롭다운에 자동 세팅
    const primaryRegion = nearestRegions[0];
    if (primaryRegion) {
      modalSelectedRegion = primaryRegion.code;
      modalSelectedSubRegion = '';
      const regionSelect = getEl('modal-region-select') as HTMLSelectElement | null;
      if (regionSelect) regionSelect.value = primaryRegion.code;
      updateSubRegions(primaryRegion.code);
    }

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
      getEl('library-empty')?.classList.remove('hidden');
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
      getEl('library-empty')?.classList.remove('hidden');
      return;
    }

    if (libraryCount) {
      libraryCount.textContent = `반경 ${radiusKm}km 이내 ${libsWithDistance.length}개 소장 도서관 (가까운 순)`;
      libraryCount.classList.remove('hidden');
    }

    const modeDescGps = getEl('library-mode-desc');
    if (modeDescGps) {
      modeDescGps.innerHTML = '<span class="material-symbols-outlined text-xs sm:text-sm">my_location</span> GPS 위치 기반 결과 · 지역을 변경하여 재검색할 수 있습니다.';
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
    getEl('library-empty')?.classList.remove('hidden');
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
  getEl('library-location-error')?.classList.add('hidden');
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
      getEl('library-empty')?.classList.remove('hidden');
      return;
    }

    if (libraryCount) {
      libraryCount.textContent = `총 ${libs.length}개의 도서관에서 소장 중`;
      libraryCount.classList.remove('hidden');
    }

    const modeDescRegion = getEl('library-mode-desc');
    if (modeDescRegion) {
      modeDescRegion.innerHTML = '<span class="material-symbols-outlined text-xs sm:text-sm">location_on</span> 선택 지역 기반 결과입니다.';
    }

    if (libraryList) {
      libraryList.innerHTML = libs.map((item: any) => renderLibraryCard(item.lib)).join('');
    }

    checkLoanAvailability(isbn, libs.map((item: any) => ({ lib: item.lib })));

  } catch (error) {
    getEl('library-loading')?.classList.add('hidden');
    getEl('library-empty')?.classList.remove('hidden');
    console.error('Library fetch error:', error);
  }
}

// ========================================
// Mode Switching
// ========================================

function switchToGPSMode(): void {
  libraryMode = 'gps';
  getEl('library-gps-view')?.classList.remove('hidden');
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
    getEl('library-loading')?.classList.add('hidden');
    getEl('library-location-error')?.classList.remove('hidden');
    const modeDesc = getEl('library-mode-desc');
    if (modeDesc) {
      modeDesc.innerHTML = '<span class="material-symbols-outlined text-xs sm:text-sm">location_off</span> GPS를 사용할 수 없습니다. 지역을 선택하여 검색하세요.';
    }
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

  // Review section
  initReviewSection();

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

function updateModalBookmarkBtn(isbn13: string): void {
  const btn = getEl('modal-bookmark-btn');
  const icon = getEl('modal-bookmark-icon');
  const text = getEl('modal-bookmark-text');
  if (!btn || !icon || !text) return;

  const filled = isBookmarked(isbn13);
  icon.style.fontVariationSettings = `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`;
  if (filled) {
    // 찜한 상태: 빨간 테두리 + 빨간 아이콘
    btn.classList.add('border-red-400', 'dark:border-red-500', 'text-red-500', 'dark:text-red-400', 'bg-red-50', 'dark:bg-red-900/20');
    btn.classList.remove('border-charcoal/20', 'dark:border-white/20', 'text-charcoal/50', 'dark:text-white/50');
    text.textContent = '찜 해제';
  } else {
    // 찜 전 상태: 회색 테두리 + 회색 아이콘
    btn.classList.remove('border-red-400', 'dark:border-red-500', 'text-red-500', 'dark:text-red-400', 'bg-red-50', 'dark:bg-red-900/20');
    btn.classList.add('border-charcoal/20', 'dark:border-white/20', 'text-charcoal/50', 'dark:text-white/50');
    text.textContent = '찜하기';
  }
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

  // Update purchase links
  const searchQuery = encodeURIComponent(book.bookname || '');
  const coupangLink = getEl('coupang-link') as HTMLAnchorElement | null;
  const aladinLink = getEl('aladin-link') as HTMLAnchorElement | null;
  if (coupangLink) coupangLink.href = `https://www.coupang.com/np/search?q=${searchQuery}`;
  if (aladinLink) aladinLink.href = `https://www.aladin.co.kr/search/wsearchresult.aspx?SearchWord=${searchQuery}`;

  resetAiInsightState();
  resetReviewState();
  resetUserReviewsState();
  resetLibraryState();
  _callbacks.onOpen?.(book);

  // 모달 먼저 열고, 세션 비동기 확인 후 로그인 상태에 따라 UI 업데이트
  getEl('my-review-form')?.classList.add('hidden');
  getEl('my-review-login-prompt')?.classList.add('hidden');

  modal?.classList.remove('hidden');

  // 찜하기 버튼 상태 초기화
  if (book.isbn13) {
    updateModalBookmarkBtn(book.isbn13);
  }

  // 찜하기 버튼 클릭 핸들러 (매번 새로 등록 방지: replaceWith clone)
  const bookmarkBtn = getEl('modal-bookmark-btn');
  if (bookmarkBtn && book.isbn13) {
    const newBtn = bookmarkBtn.cloneNode(true) as HTMLElement;
    bookmarkBtn.replaceWith(newBtn);
    newBtn.addEventListener('click', async () => {
      if (!getUserId()) {
        document.getElementById('signin-btn')?.click();
        return;
      }
      await toggleBookmark({
        isbn13: book.isbn13,
        bookname: book.bookname,
        authors: book.authors,
        publisher: book.publisher,
        publication_year: book.publication_year,
        bookImageURL: book.bookImageURL,
      });
      updateModalBookmarkBtn(book.isbn13);
    });
  }

  getAuthToken().then(token => {
    if (token) {
      getEl('my-review-form')?.classList.remove('hidden');
      getEl('my-review-login-prompt')?.classList.add('hidden');
    } else {
      getEl('my-review-form')?.classList.add('hidden');
      getEl('my-review-login-prompt')?.classList.remove('hidden');
    }
  });
  fetchBookDetails(book.isbn13 || '', book.bookname || '');

  // Fetch user reviews for this book
  if (book.isbn13) {
    fetchBookReviews(book.isbn13);
  }

  // Auto-start library search with GPS/region fallback
  startLibrarySearch();
}

export function closeBookModal(): void {
  getEl('book-modal')?.classList.add('hidden');
  resetAiInsightState();
  resetReviewState();
  resetUserReviewsState();
  resetLibraryState();
  _currentBook = null;
  _callbacks.onClose?.();
}
