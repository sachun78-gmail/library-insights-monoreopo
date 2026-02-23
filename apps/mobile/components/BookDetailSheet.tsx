import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useAuth } from "../lib/auth-context";
import { api } from "../lib/api";
import type { Book, AIInsight, Library, Bookmark } from "../lib/types";

interface Props {
  book: Book | null;
  onClose: () => void;
}

const PLACEHOLDER = "https://via.placeholder.com/80x110?text=No+Image";

const REGIONS = [
  { code: "11", name: "서울" }, { code: "21", name: "부산" },
  { code: "22", name: "대구" }, { code: "23", name: "인천" },
  { code: "24", name: "광주" }, { code: "25", name: "대전" },
  { code: "31", name: "경기" }, { code: "32", name: "강원" },
  { code: "39", name: "제주" },
];

export function BookDetailSheet({ book, onClose }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showLibrary, setShowLibrary] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState("11");

  // AI 인사이트
  const { data: insight, isLoading: isInsightLoading } = useQuery<AIInsight>({
    queryKey: ["ai-insight", book?.bookname],
    queryFn: () => api.bookAIInsight(book!.bookname, book?.authors),
    enabled: !!book,
    staleTime: 7 * 24 * 60 * 60 * 1000,
    retry: false,
  });

  // 북마크 목록
  const { data: bookmarks } = useQuery<Bookmark[]>({
    queryKey: ["bookmarks", user?.id],
    queryFn: () => api.bookmarks(user!.id),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const isBookmarked = bookmarks?.some((b) => b.isbn13 === book?.isbn13) ?? false;

  // 북마크 추가/제거
  const addMutation = useMutation({
    mutationFn: () => api.addBookmark(user!.id, book!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookmarks", user?.id] }),
  });
  const removeMutation = useMutation({
    mutationFn: () => api.removeBookmark(user!.id, book!.isbn13),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookmarks", user?.id] }),
  });

  const handleBookmark = () => {
    if (!user) {
      Alert.alert("로그인 필요", "찜하기 기능은 로그인 후 이용 가능합니다.", [
        { text: "취소", style: "cancel" },
        { text: "로그인", onPress: () => { onClose(); router.push("/login"); } },
      ]);
      return;
    }
    if (isBookmarked) removeMutation.mutate();
    else addMutation.mutate();
  };

  // 도서관 검색
  const { data: libraries, isLoading: isLibLoading } = useQuery<Library[]>({
    queryKey: ["libraries", book?.isbn13, selectedRegion],
    queryFn: () => api.libraryByBook(book!.isbn13, selectedRegion),
    enabled: !!book && showLibrary,
    staleTime: 10 * 60 * 1000,
  });

  const isMutating = addMutation.isPending || removeMutation.isPending;

  return (
    <Modal
      visible={!!book}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} />
      </TouchableWithoutFeedback>

      <View style={styles.sheet}>
        {/* Handle bar */}
        <View style={styles.handle} />

        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          {book && (
            <>
              {/* Book header */}
              <View style={styles.bookHeader}>
                <Image
                  source={{ uri: book.bookImageURL || PLACEHOLDER }}
                  style={styles.bookImage}
                  resizeMode="cover"
                />
                <View style={styles.bookInfo}>
                  <Text style={styles.bookTitle} numberOfLines={4}>
                    {book.bookname}
                  </Text>
                  <Text style={styles.bookAuthor}>{book.authors}</Text>
                  <Text style={styles.bookPublisher}>
                    {book.publisher}
                    {book.publication_year ? ` · ${book.publication_year}` : ""}
                  </Text>
                  {book.class_nm && (
                    <View style={styles.classBadge}>
                      <Text style={styles.classText}>{book.class_nm}</Text>
                    </View>
                  )}
                </View>
                {/* 북마크 버튼 */}
                <TouchableOpacity
                  style={styles.bookmarkBtn}
                  onPress={handleBookmark}
                  disabled={isMutating}
                >
                  {isMutating ? (
                    <ActivityIndicator size="small" color="#DC2626" />
                  ) : (
                    <Ionicons
                      name={isBookmarked ? "heart" : "heart-outline"}
                      size={26}
                      color={isBookmarked ? "#DC2626" : "#9CA3AF"}
                    />
                  )}
                </TouchableOpacity>
              </View>

              {/* AI Insight */}
              {isInsightLoading && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#D97706" />
                  <Text style={styles.loadingText}>AI 분석 중...</Text>
                </View>
              )}
              {insight && (
                <View style={styles.insightBox}>
                  <Text style={styles.insightTitle}>✨ AI 도서 인사이트</Text>
                  <Text style={styles.insightSummary}>{insight.summary}</Text>
                  <View style={styles.insightRow}>
                    <View style={styles.insightCard}>
                      <Text style={styles.insightCardLabel}>핵심 메시지</Text>
                      <Text style={styles.insightCardText}>{insight.keyMessage}</Text>
                    </View>
                    <View style={styles.insightCard}>
                      <Text style={styles.insightCardLabel}>추천 대상</Text>
                      <Text style={styles.insightCardText}>{insight.recommendFor}</Text>
                    </View>
                  </View>
                  <View style={[styles.insightCard, { marginTop: 0 }]}>
                    <Text style={styles.insightCardLabel}>난이도</Text>
                    <Text style={styles.insightCardText}>{insight.difficulty}</Text>
                  </View>
                </View>
              )}

              {/* 도서 소개 */}
              {book.description && (
                <View style={styles.descBox}>
                  <Text style={styles.descLabel}>책 소개</Text>
                  <Text style={styles.descText}>{book.description}</Text>
                </View>
              )}

              {/* 도서관 검색 */}
              <View style={styles.librarySection}>
                <TouchableOpacity
                  style={styles.libraryToggle}
                  onPress={() => setShowLibrary(!showLibrary)}
                >
                  <Ionicons name="library-outline" size={18} color="#374151" />
                  <Text style={styles.libraryToggleText}>소장 도서관 검색</Text>
                  <Ionicons
                    name={showLibrary ? "chevron-up" : "chevron-down"}
                    size={16}
                    color="#6B7280"
                    style={{ marginLeft: "auto" }}
                  />
                </TouchableOpacity>

                {showLibrary && (
                  <>
                    {/* 지역 선택 */}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.regionScroll}
                    >
                      {REGIONS.map((r) => (
                        <TouchableOpacity
                          key={r.code}
                          onPress={() => setSelectedRegion(r.code)}
                          style={[
                            styles.regionChip,
                            selectedRegion === r.code && styles.regionChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.regionChipText,
                              selectedRegion === r.code && styles.regionChipTextActive,
                            ]}
                          >
                            {r.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    {isLibLoading && (
                      <View style={styles.loadingRow}>
                        <ActivityIndicator size="small" color="#D97706" />
                        <Text style={styles.loadingText}>도서관 검색 중...</Text>
                      </View>
                    )}

                    {!isLibLoading && libraries?.length === 0 && (
                      <Text style={styles.noLibText}>
                        해당 지역에서 소장한 도서관이 없습니다
                      </Text>
                    )}

                    {!isLibLoading && libraries && libraries.length > 0 && (
                      <View style={styles.libraryList}>
                        {libraries.slice(0, 5).map((lib) => (
                          <View key={lib.libCode} style={styles.libraryItem}>
                            <View style={styles.libraryDot} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.libraryName}>{lib.libName}</Text>
                              <Text style={styles.libraryAddr} numberOfLines={1}>
                                {lib.address}
                              </Text>
                            </View>
                          </View>
                        ))}
                        {libraries.length > 5 && (
                          <Text style={styles.moreLibText}>
                            외 {libraries.length - 5}개 도서관
                          </Text>
                        )}
                      </View>
                    )}
                  </>
                )}
              </View>
            </>
          )}
        </ScrollView>

        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>닫기</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },

  // Book header
  bookHeader: {
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: "flex-start",
  },
  bookImage: { width: 80, height: 110, borderRadius: 8 },
  bookInfo: { flex: 1 },
  bookTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 4, lineHeight: 22 },
  bookAuthor: { fontSize: 13, color: "#4B5563", marginBottom: 2 },
  bookPublisher: { fontSize: 12, color: "#9CA3AF" },
  classBadge: {
    marginTop: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  classText: { fontSize: 11, color: "#6B7280" },
  bookmarkBtn: { padding: 4, marginTop: 2 },

  // Loading
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 20 },
  loadingText: { fontSize: 12, color: "#9CA3AF" },

  // AI Insight
  insightBox: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  insightTitle: { fontSize: 12, fontWeight: "700", color: "#92400E", marginBottom: 8 },
  insightSummary: { fontSize: 13, color: "#374151", lineHeight: 20, marginBottom: 12 },
  insightRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  insightCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 10,
  },
  insightCardLabel: { fontSize: 10, color: "#9CA3AF", marginBottom: 4 },
  insightCardText: { fontSize: 12, color: "#374151" },

  // Description
  descBox: { paddingHorizontal: 20, marginBottom: 16 },
  descLabel: { fontSize: 12, fontWeight: "600", color: "#9CA3AF", marginBottom: 6 },
  descText: { fontSize: 13, color: "#4B5563", lineHeight: 20 },

  // Library
  librarySection: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  libraryToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
  },
  libraryToggleText: { fontSize: 14, fontWeight: "600", color: "#374151" },
  regionScroll: { paddingHorizontal: 14, paddingBottom: 12, gap: 6 },
  regionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  regionChipActive: { borderColor: "#D97706", backgroundColor: "#FEF3C7" },
  regionChipText: { fontSize: 12, color: "#6B7280" },
  regionChipTextActive: { color: "#92400E", fontWeight: "600" },
  noLibText: { fontSize: 13, color: "#9CA3AF", paddingHorizontal: 14, paddingBottom: 14 },
  libraryList: { paddingHorizontal: 14, paddingBottom: 14 },
  libraryItem: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  libraryDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#D97706", marginTop: 6 },
  libraryName: { fontSize: 13, fontWeight: "600", color: "#374151" },
  libraryAddr: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  moreLibText: { fontSize: 12, color: "#9CA3AF", marginTop: 4 },

  // Close
  closeBtn: {
    marginHorizontal: 20,
    marginBottom: 32,
    marginTop: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: "center",
  },
  closeBtnText: { fontSize: 14, fontWeight: "600", color: "#6B7280" },
});
