import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { BookDetailSheet } from "../../components/BookDetailSheet";
import { AppBackground } from "../../components/AppBackground";
import type { BookReview, Book } from "../../lib/types";

const PLACEHOLDER = "https://via.placeholder.com/52x74?text=No";
const PAGE_SIZE = 20;

function reviewToBook(r: BookReview): Book {
  return {
    isbn13: r.isbn13,
    bookname: r.bookname,
    authors: r.authors,
    publisher: r.publisher,
    publication_year: "",
    bookImageURL: r.book_image_url,
  };
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <Text style={styles.stars}>
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </Text>
  );
}

function ReviewCard({ item, onBookPress }: { item: BookReview; onBookPress: (book: Book) => void }) {
  const displayName = item.display_name ||
    `독자_${item.user_id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const dateStr = new Date(item.created_at).toLocaleDateString("ko-KR");

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.bookRow} onPress={() => onBookPress(reviewToBook(item))}>
        <Image
          source={{ uri: item.book_image_url || PLACEHOLDER }}
          style={styles.bookImage}
          resizeMode="cover"
        />
        <View style={styles.bookMeta}>
          <Text style={styles.bookTitle} numberOfLines={2}>{item.bookname}</Text>
          <Text style={styles.bookAuthor} numberOfLines={1}>{item.authors}</Text>
          <Text style={styles.bookPublisher} numberOfLines={1}>{item.publisher}</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.reviewBody}>
        <View style={styles.reviewHeaderRow}>
          <StarDisplay rating={item.rating} />
          <Text style={styles.reviewerName}>{displayName}</Text>
          <Text style={styles.reviewDate}>{dateStr}</Text>
        </View>
        <Text style={styles.reviewText}>{item.review_text}</Text>
      </View>
    </View>
  );
}

export default function ReviewsScreen() {
  const [sort, setSort] = useState<"latest" | "rating">("latest");
  const [page, setPage] = useState(1);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const { data, isLoading, isError } = useQuery<{ reviews: BookReview[]; total: number }>({
    queryKey: ["all-reviews"],
    queryFn: () => api.allReviews(1, 1000),
    staleTime: 0,
  });

  const allReviews = data?.reviews ?? [];

  const sorted = useMemo(() => {
    const arr = [...allReviews];
    if (sort === "rating") {
      arr.sort((a, b) => b.rating - a.rating || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return arr;
  }, [allReviews, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSortChange = (newSort: "latest" | "rating") => {
    setSort(newSort);
    setPage(1);
  };

  return (
    <AppBackground>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>독자 한줄평</Text>
          {allReviews.length > 0 && (
            <Text style={styles.headerCount}>{allReviews.length}개</Text>
          )}
        </View>

        {/* 정렬 탭 */}
        <View style={styles.sortRow}>
          <TouchableOpacity
            style={[styles.sortBtn, sort === "latest" && styles.sortBtnActive]}
            onPress={() => handleSortChange("latest")}
          >
            <Text style={[styles.sortBtnText, sort === "latest" && styles.sortBtnTextActive]}>
              최신순
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortBtn, sort === "rating" && styles.sortBtnActive]}
            onPress={() => handleSortChange("rating")}
          >
            <Text style={[styles.sortBtnText, sort === "rating" && styles.sortBtnTextActive]}>
              별점순
            </Text>
          </TouchableOpacity>
        </View>

        {/* 목록 */}
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingText}>한줄평 불러오는 중...</Text>
          </View>
        ) : isError ? (
          <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={36} color="#64748B" />
            <Text style={styles.emptyText}>한줄평을 불러오지 못했습니다.</Text>
          </View>
        ) : sorted.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>아직 작성된 한줄평이 없습니다.</Text>
          </View>
        ) : (
          <>
            <FlatList
              data={pageItems}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ReviewCard item={item} onBookPress={setSelectedBook} />
              )}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            />

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[styles.pageBtn, page === 1 && styles.pageBtnDisabled]}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <Ionicons name="chevron-back" size={16} color={page === 1 ? "#334155" : "#818CF8"} />
                </TouchableOpacity>
                <Text style={styles.pageInfo}>{page} / {totalPages}</Text>
                <TouchableOpacity
                  style={[styles.pageBtn, page === totalPages && styles.pageBtnDisabled]}
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <Ionicons name="chevron-forward" size={16} color={page === totalPages ? "#334155" : "#818CF8"} />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </SafeAreaView>

      <BookDetailSheet book={selectedBook} onClose={() => setSelectedBook(null)} />
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#F1F5F9" },
  headerCount: { fontSize: 13, color: "#64748B", marginTop: 4 },

  sortRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  sortBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1E293B",
  },
  sortBtnActive: { backgroundColor: "#312E81", borderColor: "#4F46E5" },
  sortBtnText: { fontSize: 13, color: "#64748B", fontWeight: "600" },
  sortBtnTextActive: { color: "#A5B4FC" },

  list: { paddingHorizontal: 16, paddingBottom: 100 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { fontSize: 13, color: "#64748B" },
  emptyText: { fontSize: 14, color: "#64748B" },

  card: {
    backgroundColor: "#0F172A",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1E293B",
    marginBottom: 10,
    overflow: "hidden",
  },
  bookRow: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  bookImage: { width: 52, height: 74, borderRadius: 6 },
  bookMeta: { flex: 1, justifyContent: "center" },
  bookTitle: { fontSize: 13, fontWeight: "700", color: "#F1F5F9", marginBottom: 3, lineHeight: 18 },
  bookAuthor: { fontSize: 12, color: "#94A3B8", marginBottom: 2 },
  bookPublisher: { fontSize: 11, color: "#64748B" },

  reviewBody: { padding: 12 },
  reviewHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  stars: { fontSize: 13, color: "#FBBF24" },
  reviewerName: { fontSize: 12, fontWeight: "600", color: "#94A3B8" },
  reviewDate: { fontSize: 11, color: "#475569", marginLeft: "auto" as any },
  reviewText: { fontSize: 13, color: "#CBD5E1", lineHeight: 19 },

  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 12,
    paddingBottom: 90,
  },
  pageBtn: {
    width: 34, height: 34,
    borderRadius: 17,
    backgroundColor: "#1E293B",
    borderWidth: 1, borderColor: "#334155",
    alignItems: "center", justifyContent: "center",
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageInfo: { fontSize: 13, color: "#94A3B8", fontWeight: "600" },
});
