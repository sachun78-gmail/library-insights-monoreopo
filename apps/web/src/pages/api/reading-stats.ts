import type { APIRoute } from 'astro';
import { verifyAuth, getSupabase, safeErrorResponse } from '../../lib/auth';

export const prerender = false;

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ request, locals }) => {
  const auth = await verifyAuth(request, locals);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const supabase = getSupabase(locals);
  if (!supabase) return jsonResponse({ error: 'Supabase not configured' }, 500);

  try {
    // month 파라미터 (기본: 이번 달)
    const url = new URL(request.url);
    const monthParam = url.searchParams.get('month'); // e.g. "2026-03"
    const now = new Date();
    let targetYear = now.getFullYear();
    let targetMonth = now.getMonth(); // 0-based
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split('-').map(Number);
      targetYear = y;
      targetMonth = m - 1; // 0-based
    }

    const { data: bookmarks, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    const all = bookmarks || [];

    // 1. 요약
    const summary = {
      total: all.length,
      to_read: all.filter((b: any) => (b.reading_status || 'to_read') === 'to_read').length,
      reading: all.filter((b: any) => b.reading_status === 'reading').length,
      read: all.filter((b: any) => b.reading_status === 'read').length,
    };

    // 2. 캘린더: 해당 월에 completed_at이 있는 날짜별 완독 책 목록
    const days: Record<string, { bookname: string; authors: string }[]> = {};
    for (const b of all) {
      if (!b.completed_at) continue;
      const ca = new Date(b.completed_at);
      if (ca.getFullYear() === targetYear && ca.getMonth() === targetMonth) {
        const day = String(ca.getDate());
        if (!days[day]) days[day] = [];
        days[day].push({ bookname: b.bookname || '', authors: b.authors || '' });
      }
    }

    const calendar = {
      year: targetYear,
      month: targetMonth + 1, // 1-based for response
      days,
    };

    // 3. 이번 달 완독 수 (항상 현재 달 기준)
    const currentMonthCount = all.filter((b: any) => {
      if (!b.completed_at) return false;
      const ca = new Date(b.completed_at);
      return ca.getFullYear() === now.getFullYear() && ca.getMonth() === now.getMonth();
    }).length;

    // 올해 누적 완독 수
    const thisYear = now.getFullYear();
    const yearlyTotal = all.filter((b: any) => {
      if (!b.completed_at) return false;
      return new Date(b.completed_at).getFullYear() === thisYear;
    }).length;

    // 연속 독서 달 수 (이번 달 포함, 과거로 거슬러 올라가며 완독이 있는 연속 월 수)
    let streak = 0;
    for (let i = 0; i < 24; i++) {
      const d = new Date(thisYear, now.getMonth() - i, 1);
      const hasRead = all.some((b: any) => {
        if (!b.completed_at) return false;
        const ca = new Date(b.completed_at);
        return ca.getFullYear() === d.getFullYear() && ca.getMonth() === d.getMonth();
      });
      if (hasRead) streak++;
      else break;
    }

    const monthlyReport = {
      currentMonth: currentMonthCount,
      monthLabel: `${now.getMonth() + 1}월`,
      goal: 5,
      yearlyTotal,
      streak,
    };

    // 4. 월별 완독 추이 (최근 6개월) - 기존 호환
    const months: { month: string; label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${d.getMonth() + 1}월`;
      const count = all.filter((b: any) => {
        if (!b.completed_at) return false;
        const ca = new Date(b.completed_at);
        return ca.getFullYear() === d.getFullYear() && ca.getMonth() === d.getMonth();
      }).length;
      months.push({ month, label, count });
    }

    // 5. 가장 많이 읽은 저자 TOP 5
    const authorCount: Record<string, number> = {};
    for (const b of all) {
      if (b.reading_status !== 'read') continue;
      const authors = (b.authors || '').split(/[,;]/).map((a: string) => a.trim()).filter(Boolean);
      for (const author of authors) {
        authorCount[author] = (authorCount[author] || 0) + 1;
      }
    }
    const topAuthors = Object.entries(authorCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([author, count]) => ({ author, count }));

    // 6. 출판년도 분포
    const yearCount: Record<string, number> = {};
    for (const b of all) {
      const year = b.publication_year?.toString().trim();
      if (year) {
        yearCount[year] = (yearCount[year] || 0) + 1;
      }
    }
    const publicationYearDist = Object.entries(yearCount)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, count]) => ({ year, count }));

    return jsonResponse({
      summary,
      calendar,
      monthlyReport,
      monthlyCompleted: months,
      topAuthors,
      publicationYearDist,
    });
  } catch (error) {
    return safeErrorResponse(error);
  }
};
