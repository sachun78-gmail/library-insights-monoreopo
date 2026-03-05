import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth-context";
import { api } from "../../lib/api";
import { BookDetailSheet } from "../../components/BookDetailSheet";
import { AppBackground } from "../../components/AppBackground";
import type { Bookmark, Book, ReadingStatus, ReadingStats } from "../../lib/types";

const PLACEHOLDER = "https://via.placeholder.com/52x74?text=No";

type FilterKey = "all" | ReadingStatus;

const STATUS_CONFIG: Record<ReadingStatus, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  to_read: { label: "읽기전", icon: "bookmark-outline",  color: "#94A3B8", bg: "#1E293B" },
  reading: { label: "읽는중", icon: "book-outline",      color: "#3B82F6", bg: "#1E3A5F" },
  read:    { label: "읽음",   icon: "checkmark-circle-outline", color: "#22C55E", bg: "#14312B" },
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",     label: "전체" },
  { key: "to_read", label: "읽기전" },
  { key: "reading", label: "읽는중" },
  { key: "read",    label: "읽음" },
];

function StatsSection({ stats, onMonthChange }: { stats: ReadingStats; onMonthChange: (month: string) => void }) {
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);
  const [navVisible, setNavVisible] = React.useState(false);

  const now = new Date();
  const calendar = stats.calendar ?? { year: now.getFullYear(), month: now.getMonth() + 1, days: {} };
  const monthlyReport = stats.monthlyReport ?? { currentMonth: 0, monthLabel: `${now.getMonth() + 1}월`, goal: 5, yearlyTotal: 0, streak: 0 };

  const { year, month, days } = calendar;
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const navigateMonth = (delta: number) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth > 12) { newYear++; newMonth = 1; }
    if (newMonth < 1) { newYear--; newMonth = 12; }
    onMonthChange(`${newYear}-${String(newMonth).padStart(2, '0')}`);
    setSelectedDay(null);
  };

  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <View style={statsStyles.container}>
      {/* 독서 캘린더 */}
      <View style={statsStyles.chartCard}>
        <View style={statsStyles.headerRow}>
          <Text style={statsStyles.chartTitle}>{month}월 독서 캘린더</Text>
          <TouchableOpacity onPress={() => setNavVisible(!navVisible)}>
            <Text style={statsStyles.toggleText}>{navVisible ? '접기' : '전체보기'}</Text>
          </TouchableOpacity>
        </View>

        {navVisible && (
          <View style={statsStyles.navRow}>
            <TouchableOpacity style={statsStyles.navBtn} onPress={() => navigateMonth(-1)}>
              <Ionicons name="chevron-back" size={16} color="#F1F5F9" />
            </TouchableOpacity>
            <Text style={statsStyles.navLabel}>{year}년 {month}월</Text>
            <TouchableOpacity style={statsStyles.navBtn} onPress={() => navigateMonth(1)}>
              <Ionicons name="chevron-forward" size={16} color="#F1F5F9" />
            </TouchableOpacity>
          </View>
        )}

        {/* 요일 헤더 */}
        <View style={statsStyles.weekRow}>
          {WEEKDAYS.map((w, i) => (
            <Text key={w} style={[statsStyles.weekDay, i === 0 && { color: '#F87171' }, i === 6 && { color: '#60A5FA' }]}>{w}</Text>
          ))}
        </View>

        {/* 날짜 그리드 */}
        <View style={statsStyles.calendarGrid}>
          {calendarDays.map((d, idx) => {
            if (d === null) return <View key={`empty-${idx}`} style={statsStyles.dayCell} />;
            const dayStr = String(d);
            const hasBooks = days[dayStr] && days[dayStr].length > 0;
            const isToday = isCurrentMonth && today.getDate() === d;
            const dayOfWeek = (firstDay + d - 1) % 7;
            return (
              <TouchableOpacity
                key={d}
                style={[statsStyles.dayCell, isToday && statsStyles.todayCell]}
                onPress={() => hasBooks && setSelectedDay(selectedDay === dayStr ? null : dayStr)}
                activeOpacity={hasBooks ? 0.6 : 1}
              >
                <Text style={[
                  statsStyles.dayText,
                  dayOfWeek === 0 && { color: '#F87171' },
                  dayOfWeek === 6 && { color: '#60A5FA' },
                  isToday && { fontWeight: '700' },
                ]}>{d}</Text>
                {hasBooks && <View style={statsStyles.dot} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 선택한 날짜 상세 */}
        {selectedDay && days[selectedDay] && (
          <View style={statsStyles.detailBox}>
            <Text style={statsStyles.detailTitle}>{month}월 {selectedDay}일 완독</Text>
            {days[selectedDay].map((b, i) => (
              <View key={i} style={statsStyles.detailItem}>
                <Ionicons name="checkmark-circle" size={14} color="#D97706" />
                <View style={{ flex: 1 }}>
                  <Text style={statsStyles.detailBookName} numberOfLines={1}>{b.bookname}</Text>
                  <Text style={statsStyles.detailAuthors} numberOfLines={1}>{b.authors}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 캘린더 하단 요약 */}
        <View style={statsStyles.calendarFooter}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#D97706' }} />
            <Text style={{ fontSize: 10, color: '#64748B' }}>완독일</Text>
          </View>
          <Text style={{ fontSize: 10, color: '#64748B' }}>
            {(() => {
              const totalDays = Object.keys(days).length;
              const totalBooks = Object.values(days).reduce((sum, arr) => sum + arr.length, 0);
              return totalBooks > 0 ? `${totalDays}일 · ${totalBooks}권 완독` : '완독 기록이 없습니다';
            })()}
          </Text>
        </View>
      </View>

      {/* 독서 리포트 */}
      <View style={statsStyles.chartCard}>
        <Text style={statsStyles.chartTitle}>독서 리포트</Text>

        {/* 월간 완독 + 목표 */}
        <View style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={statsStyles.reportLabel}>{monthlyReport.monthLabel} 완독 현황</Text>
            <Text style={{ fontSize: 11, color: '#64748B' }}>목표 {monthlyReport.goal || 5}권</Text>
          </View>
          <View style={statsStyles.reportBarBg}>
            <View style={[statsStyles.reportBar, { width: `${Math.min((monthlyReport.currentMonth / (monthlyReport.goal || 5)) * 100, 100)}%` as any }]} />
          </View>
          <Text style={[statsStyles.reportCount, { textAlign: 'center', marginTop: 6 }]}>{monthlyReport.currentMonth}권 완독</Text>
        </View>

        {/* 구분선 */}
        <View style={{ height: 1, backgroundColor: '#334155', marginBottom: 12 }} />

        {/* 올해 누적 + 연속 독서 */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <View style={statsStyles.statBox}>
            <Text style={statsStyles.statBoxLabel}>{new Date().getFullYear()}년 완독</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={statsStyles.statBoxValue}>{monthlyReport.yearlyTotal ?? 0}</Text>
              <Text style={statsStyles.statBoxUnit}>권</Text>
            </View>
          </View>
          <View style={statsStyles.statBox}>
            <Text style={statsStyles.statBoxLabel}>연속 독서</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={statsStyles.statBoxValue}>{monthlyReport.streak ?? 0}</Text>
              <Text style={statsStyles.statBoxUnit}>개월</Text>
            </View>
          </View>
        </View>

        {/* 많이 읽은 저자 TOP 3 */}
        <View>
          <Text style={{ fontSize: 10, color: '#64748B', marginBottom: 6 }}>많이 읽은 저자</Text>
          {(stats.topAuthors ?? []).length === 0 ? (
            <Text style={{ fontSize: 10, color: '#475569' }}>아직 읽은 책이 없습니다</Text>
          ) : (
            (stats.topAuthors ?? []).slice(0, 3).map((a, i) => {
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <View key={a.author} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Text style={{ fontSize: 12 }}>{medals[i]}</Text>
                  <Text style={{ fontSize: 12, color: '#94A3B8', flex: 1 }} numberOfLines={1}>{a.author}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#F1F5F9' }}>{a.count}권</Text>
                </View>
              );
            })
          )}
        </View>
      </View>
    </View>
  );
}

function bookmarkToBook(b: Bookmark): Book {
  return {
    isbn13: b.isbn13,
    bookname: b.bookname,
    authors: b.authors,
    publisher: b.publisher,
    publication_year: b.publication_year,
    bookImageURL: b.book_image_url,
  };
}

export default function BookshelfScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [statsMonth, setStatsMonth] = useState<string | undefined>(undefined);

  const { data: bookmarks, isLoading } = useQuery<Bookmark[]>({
    queryKey: ["bookmarks", user?.id],
    queryFn: () => api.bookmarks(),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const { data: stats } = useQuery<ReadingStats>({
    queryKey: ["reading-stats", user?.id, statsMonth],
    queryFn: () => api.readingStats(statsMonth),
    enabled: !!user && !!bookmarks && bookmarks.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  const removeMutation = useMutation({
    mutationFn: ({ isbn13 }: { isbn13: string }) => api.removeBookmark(isbn13),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["bookmarks", user?.id] }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ isbn13, status }: { isbn13: string; status: ReadingStatus }) =>
      api.updateReadingStatus(isbn13, status),
    onMutate: async ({ isbn13, status }) => {
      await queryClient.cancelQueries({ queryKey: ["bookmarks", user?.id] });
      const prev = queryClient.getQueryData<Bookmark[]>(["bookmarks", user?.id]);
      queryClient.setQueryData<Bookmark[]>(["bookmarks", user?.id], (old) =>
        old?.map((b) => b.isbn13 === isbn13 ? { ...b, reading_status: status } : b) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["bookmarks", user?.id], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["reading-stats", user?.id] });
    },
  });

  const handleRemove = (isbn13: string, bookname: string) => {
    Alert.alert("찜 해제", `'${bookname}'을(를) 서재에서 제거할까요?`, [
      { text: "취소", style: "cancel" },
      { text: "제거", style: "destructive", onPress: () => removeMutation.mutate({ isbn13 }) },
    ]);
  };

  const filtered =
    activeFilter === "all"
      ? (bookmarks ?? [])
      : (bookmarks ?? []).filter((b) => (b.reading_status ?? "to_read") === activeFilter);

  const countOf = (key: FilterKey) =>
    key === "all"
      ? (bookmarks?.length ?? 0)
      : (bookmarks?.filter((b) => (b.reading_status ?? "to_read") === key).length ?? 0);

  const readCount = countOf("read");

  // 로그인 유도 화면
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <AppBackground>
          <View style={styles.centerBox}>
            <Ionicons name="bookmark-outline" size={64} color="#D97706" />
            <Text style={styles.emptyTitle}>내 서재</Text>
            <Text style={styles.emptySubtitle}>
              로그인하면 찜한 도서를 모아볼 수 있습니다
            </Text>
            <TouchableOpacity style={styles.loginBtn} onPress={() => router.push("/login")}>
              <Text style={styles.loginBtnText}>로그인하기</Text>
            </TouchableOpacity>
          </View>
        </AppBackground>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>내 서재</Text>
            {readCount > 0 && (
              <Text style={styles.headerReadCount}>읽음 {readCount}권</Text>
            )}
          </View>
          <Text style={styles.headerCount}>{bookmarks?.length ?? 0}권</Text>
        </View>

        {/* Filter Tabs */}
        {!isLoading && bookmarks && bookmarks.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterContent}
          >
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterTab, activeFilter === f.key && styles.filterTabActive]}
                onPress={() => setActiveFilter(f.key)}
              >
                <Text style={[styles.filterTabText, activeFilter === f.key && styles.filterTabTextActive]}>
                  {f.label}
                </Text>
                <View style={[styles.filterBadge, activeFilter === f.key && styles.filterBadgeActive]}>
                  <Text style={[styles.filterBadgeText, activeFilter === f.key && styles.filterBadgeTextActive]}>
                    {countOf(f.key)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {isLoading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#D97706" />
          </View>
        )}

        {!isLoading && (!bookmarks || bookmarks.length === 0) && (
          <View style={styles.centerBox}>
            <Ionicons name="book-outline" size={56} color="#334155" />
            <Text style={styles.emptyTitle}>아직 찜한 도서가 없습니다</Text>
            <Text style={styles.emptySubtitle}>
              도서 상세화면에서 하트를 눌러 서재에 추가하세요
            </Text>
          </View>
        )}

        {!isLoading && bookmarks && bookmarks.length > 0 && filtered.length === 0 && (
          <View style={styles.centerBox}>
            <Ionicons name="book-outline" size={48} color="#334155" />
            <Text style={styles.emptyTitle}>해당 상태의 도서가 없습니다</Text>
          </View>
        )}

        {!isLoading && filtered.length > 0 && (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.isbn13}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            ListHeaderComponent={stats ? <StatsSection stats={stats} onMonthChange={setStatsMonth} /> : null}
            renderItem={({ item }) => {
              const status: ReadingStatus = item.reading_status ?? "to_read";
              const cfg = STATUS_CONFIG[status];
              return (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => setSelectedBook(bookmarkToBook(item))}
                  activeOpacity={0.8}
                >
                  {/* 책 이미지 + 상태 뱃지 */}
                  <View>
                    <Image
                      source={{ uri: item.book_image_url || PLACEHOLDER }}
                      style={styles.cardImage}
                      resizeMode="cover"
                    />
                    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                      <Ionicons name={cfg.icon} size={10} color={cfg.color} />
                    </View>
                  </View>

                  {/* 책 정보 */}
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {item.bookname}
                    </Text>
                    <Text style={styles.cardAuthor} numberOfLines={1}>
                      {item.authors}
                    </Text>
                    <Text style={styles.cardPublisher} numberOfLines={1}>
                      {item.publisher}
                      {item.publication_year ? ` · ${item.publication_year}` : ""}
                    </Text>

                    {/* 독서 상태 3-버튼 토글 */}
                    <View style={styles.statusRow}>
                      {(Object.entries(STATUS_CONFIG) as [ReadingStatus, typeof STATUS_CONFIG[ReadingStatus]][]).map(([key, s]) => {
                        const isActive = status === key;
                        return (
                          <TouchableOpacity
                            key={key}
                            style={[
                              styles.statusBtn,
                              isActive && { borderColor: s.color, backgroundColor: s.bg },
                            ]}
                            onPress={(e) => {
                              if (!isActive) statusMutation.mutate({ isbn13: item.isbn13, status: key });
                            }}
                          >
                            <Ionicons
                              name={isActive ? s.icon.replace("-outline", "") as any : s.icon}
                              size={12}
                              color={isActive ? s.color : "#475569"}
                            />
                            <Text style={[styles.statusBtnText, isActive && { color: s.color }]}>
                              {s.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* 찜 해제 버튼 */}
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => handleRemove(item.isbn13, item.bookname)}
                  >
                    <Ionicons name="heart" size={22} color="#DC2626" />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }}
          />
        )}

        <BookDetailSheet
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
        />
      </AppBackground>
    </SafeAreaView>
  );
}

const statsStyles = StyleSheet.create({
  container: { marginBottom: 16 },
  chartCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 12,
  },
  chartTitle: { fontSize: 13, fontWeight: "700", color: "#F1F5F9", marginBottom: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  toggleText: { fontSize: 12, color: "#D97706", fontWeight: "500" },
  navRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 16, marginBottom: 12 },
  navBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: { fontSize: 14, fontWeight: "700", color: "#F1F5F9", minWidth: 100, textAlign: "center" },
  weekRow: { flexDirection: "row", marginBottom: 6 },
  weekDay: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", color: "#64748B", paddingVertical: 4 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 4 },
  dayCell: {
    width: `${100 / 7}%` as any,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  todayCell: { backgroundColor: "rgba(217, 119, 6, 0.1)", borderRadius: 10 },
  dayText: { fontSize: 14, color: "#94A3B8" },
  dot: { position: "absolute", bottom: 4, width: 5, height: 5, borderRadius: 3, backgroundColor: "#D97706" },
  detailBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  detailTitle: { fontSize: 12, fontWeight: "700", color: "#F1F5F9", marginBottom: 8 },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  detailBookName: { fontSize: 12, fontWeight: "500", color: "#F1F5F9" },
  detailAuthors: { fontSize: 10, color: "#64748B" },
  calendarFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  reportLabel: { fontSize: 12, color: "#94A3B8" },
  reportBarBg: { width: "100%" as any, height: 24, backgroundColor: "#0F172A", borderRadius: 12, overflow: "hidden" },
  reportBar: { height: "100%" as any, backgroundColor: "#D97706", borderRadius: 12, minWidth: 0 },
  reportCount: { fontSize: 16, fontWeight: "700", color: "#F1F5F9" },
  statBox: {
    flex: 1,
    alignItems: "center" as const,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#0F172A",
  },
  statBoxLabel: { fontSize: 10, color: "#64748B", marginBottom: 4 },
  statBoxValue: { fontSize: 22, fontWeight: "700" as const, color: "#F1F5F9" },
  statBoxUnit: { fontSize: 11, color: "#64748B", marginLeft: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#071426" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "#0F172A",
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#F1F5F9" },
  headerReadCount: { fontSize: 11, color: "#22C55E", marginTop: 2 },
  headerCount: { fontSize: 14, color: "#94A3B8" },
  // Filter tabs
  filterScroll: { flexGrow: 0, flexShrink: 0, backgroundColor: "#0F172A", borderBottomWidth: 1, borderBottomColor: "#1E293B" },
  filterContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 6, flexDirection: "row", alignItems: "center" },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "transparent",
  },
  filterTabActive: { backgroundColor: "#1E293B", borderColor: "#F1F5F9" },
  filterTabText: { fontSize: 13, color: "#64748B", fontWeight: "500" },
  filterTabTextActive: { color: "#F1F5F9", fontWeight: "700" },
  filterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  filterBadgeActive: { backgroundColor: "#334155" },
  filterBadgeText: { fontSize: 10, color: "#64748B", fontWeight: "600" },
  filterBadgeTextActive: { color: "#F1F5F9" },
  // Center
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#F1F5F9", marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#64748B", textAlign: "center", lineHeight: 20 },
  loginBtn: { marginTop: 24, backgroundColor: "#D97706", paddingHorizontal: 32, paddingVertical: 13, borderRadius: 12 },
  loginBtnText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  // Card
  card: {
    flexDirection: "row",
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  cardImage: { width: 52, height: 74, borderRadius: 6 },
  statusBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#0F172A",
  },
  cardInfo: { flex: 1, marginHorizontal: 12 },
  cardTitle: { fontSize: 14, fontWeight: "600", color: "#F1F5F9", marginBottom: 4, lineHeight: 20 },
  cardAuthor: { fontSize: 12, color: "#94A3B8", marginBottom: 2 },
  cardPublisher: { fontSize: 11, color: "#64748B", marginBottom: 8 },
  // Status toggle
  statusRow: { flexDirection: "row", gap: 4 },
  statusBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "transparent",
  },
  statusBtnText: { fontSize: 10, color: "#475569", fontWeight: "500" },
  removeBtn: { padding: 6 },
});
