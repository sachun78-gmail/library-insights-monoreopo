import { supabase } from '../lib/supabase';

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

interface CalendarDay {
  bookname: string;
  authors: string;
}

interface ReadingStats {
  summary: { total: number; to_read: number; reading: number; read: number };
  calendar: { year: number; month: number; days: Record<string, CalendarDay[]> };
  monthlyReport: { currentMonth: number; monthLabel: string; goal: number; yearlyTotal: number; streak: number };
  monthlyCompleted: { month: string; label: string; count: number }[];
  topAuthors: { author: string; count: number }[];
  publicationYearDist: { year: string; count: number }[];
}

let currentYear: number;
let currentMonth: number; // 1-based
let navVisible = false;
let authToken: string | null = null;
let navSetup = false;

export async function loadAndRenderStats(): Promise<void> {
  const token = await getAuthToken();
  if (!token) return;
  authToken = token;

  const statsEl = document.getElementById('reading-stats');
  if (!statsEl) return;

  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth() + 1;

  try {
    const stats = await fetchStats();
    if (stats.summary.total === 0) return;

    statsEl.classList.remove('hidden');
    renderCalendar(stats.calendar);
    renderReport(stats.monthlyReport, stats.topAuthors);
    if (!navSetup) {
      setupNavigation();
      navSetup = true;
    }
  } catch {
    // 통계 로드 실패 시 섹션 숨김
  }
}

async function fetchStats(month?: string): Promise<ReadingStats> {
  const params = month ? `?month=${month}` : '';
  const res = await fetch(`/api/reading-stats${params}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

function renderCalendar(calendar: ReadingStats['calendar']) {
  const { year, month, days } = calendar;

  // 제목 업데이트
  const monthLabel = document.getElementById('calendar-month-label');
  if (monthLabel) monthLabel.textContent = `${month}월 독서 캘린더`;

  const navLabel = document.getElementById('calendar-nav-label');
  if (navLabel) navLabel.textContent = `${year}년 ${month}월`;

  // 캘린더 그리드 생성
  const grid = document.getElementById('calendar-grid');
  if (!grid) return;

  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=일요일
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

  let html = '';

  // 빈 칸 (첫째 날 이전)
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="h-8 sm:h-9"></div>';
  }

  // 날짜들
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = String(d);
    const hasBooks = days[dayStr] && days[dayStr].length > 0;
    const isToday = isCurrentMonth && today.getDate() === d;
    const dayOfWeek = (firstDay + d - 1) % 7;
    const isSunday = dayOfWeek === 0;
    const isSaturday = dayOfWeek === 6;

    let textColor = 'text-charcoal/70 dark:text-white/70';
    if (isSunday) textColor = 'text-red-400';
    if (isSaturday) textColor = 'text-blue-400';

    html += `
      <button class="relative h-8 sm:h-9 flex flex-col items-center justify-center rounded-lg transition-colors
        ${isToday ? 'bg-primary/10 ring-1 ring-primary' : ''}
        ${hasBooks ? 'cursor-pointer hover:bg-charcoal/5 dark:hover:bg-white/10' : 'cursor-default'}
      " ${hasBooks ? `data-calendar-day="${dayStr}"` : ''}>
        <span class="text-xs ${textColor} ${isToday ? 'font-bold' : ''}">${d}</span>
        ${hasBooks ? '<span class="absolute bottom-0.5 w-1.5 h-1.5 rounded-full bg-primary"></span>' : ''}
      </button>
    `;
  }

  grid.innerHTML = html;

  // 날짜 클릭 이벤트
  grid.querySelectorAll('[data-calendar-day]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const day = (btn as HTMLElement).dataset.calendarDay!;
      toggleDayDetail(day, days[day] || [], calendar.year, calendar.month);
    });
  });

  // 상세 숨기기
  const detail = document.getElementById('calendar-detail');
  if (detail) detail.classList.add('hidden');

  // 하단 요약
  const summaryText = document.getElementById('calendar-summary-text');
  if (summaryText) {
    const totalDays = Object.keys(days).length;
    const totalBooks = Object.values(days).reduce((sum, arr) => sum + arr.length, 0);
    if (totalBooks > 0) {
      summaryText.textContent = `${totalDays}일 · ${totalBooks}권 완독`;
    } else {
      summaryText.textContent = '이번 달 완독 기록이 없습니다';
    }
  }
}

function toggleDayDetail(day: string, books: CalendarDay[], year: number, month: number) {
  const detail = document.getElementById('calendar-detail');
  const title = document.getElementById('calendar-detail-title');
  const list = document.getElementById('calendar-detail-list');
  if (!detail || !title || !list) return;

  // 이미 같은 날짜가 열려있으면 닫기
  if (!detail.classList.contains('hidden') && title.dataset.currentDay === day) {
    detail.classList.add('hidden');
    return;
  }

  title.textContent = `${month}월 ${day}일 완독`;
  title.dataset.currentDay = day;

  list.innerHTML = books.map((b) => `
    <div class="flex items-center gap-2 py-1">
      <span class="material-symbols-outlined text-primary text-sm">check_circle</span>
      <div class="min-w-0">
        <p class="text-xs font-medium text-charcoal dark:text-white truncate">${b.bookname}</p>
        <p class="text-[10px] text-charcoal/50 dark:text-white/50 truncate">${b.authors}</p>
      </div>
    </div>
  `).join('');

  detail.classList.remove('hidden');
}

function renderReport(report: ReadingStats['monthlyReport'], topAuthors: ReadingStats['topAuthors']) {
  const label = document.getElementById('report-month-label');
  const goalLabel = document.getElementById('report-goal-label');
  const count = document.getElementById('report-count');
  const bar = document.getElementById('report-bar');
  const yearLabel = document.getElementById('report-year-label');
  const yearly = document.getElementById('report-yearly');
  const streak = document.getElementById('report-streak');
  const authorsEl = document.getElementById('report-top-authors');

  // 월간 완독 + 목표
  const goal = report.goal || 5;
  if (label) label.textContent = `${report.monthLabel} 완독 현황`;
  if (goalLabel) goalLabel.textContent = `목표 ${goal}권`;
  if (count) count.textContent = String(report.currentMonth);
  if (bar) {
    const pct = Math.min((report.currentMonth / goal) * 100, 100);
    bar.style.width = `${Math.max(pct, report.currentMonth > 0 ? 10 : 0)}%`;
  }

  // 올해 누적
  const thisYear = new Date().getFullYear();
  if (yearLabel) yearLabel.textContent = `${thisYear}년 완독`;
  if (yearly) yearly.textContent = String(report.yearlyTotal ?? 0);

  // 연속 독서
  if (streak) streak.textContent = String(report.streak ?? 0);

  // 많이 읽은 저자 TOP 3
  if (authorsEl) {
    const top3 = topAuthors.slice(0, 3);
    if (top3.length === 0) {
      authorsEl.innerHTML = '<p class="text-[10px] text-charcoal/30 dark:text-white/30">아직 읽은 책이 없습니다</p>';
    } else {
      authorsEl.innerHTML = top3.map((a, i) => {
        const medals = ['🥇', '🥈', '🥉'];
        return `
          <div class="flex items-center gap-2">
            <span class="text-xs">${medals[i] || ''}</span>
            <span class="text-xs text-charcoal/70 dark:text-white/70 flex-1 truncate">${a.author}</span>
            <span class="text-xs font-bold text-charcoal dark:text-white">${a.count}권</span>
          </div>
        `;
      }).join('');
    }
  }
}

function setupNavigation() {
  const toggleBtn = document.getElementById('calendar-toggle-nav') as HTMLElement | null;
  const nav = document.getElementById('calendar-nav');
  const prevBtn = document.getElementById('calendar-prev') as HTMLElement | null;
  const nextBtn = document.getElementById('calendar-next') as HTMLElement | null;

  if (toggleBtn) {
    toggleBtn.onclick = () => {
      navVisible = !navVisible;
      if (nav) nav.classList.toggle('hidden', !navVisible);
      toggleBtn.textContent = navVisible ? '접기' : '전체보기';
    };
  }

  if (prevBtn) prevBtn.onclick = () => navigateMonth(-1);
  if (nextBtn) nextBtn.onclick = () => navigateMonth(1);
}

async function navigateMonth(delta: number) {
  currentMonth += delta;
  if (currentMonth > 12) { currentYear++; currentMonth = 1; }
  if (currentMonth < 1) { currentYear--; currentMonth = 12; }

  const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  try {
    const stats = await fetchStats(monthStr);
    renderCalendar(stats.calendar);
  } catch {
    // 실패 시 무시
  }
}
