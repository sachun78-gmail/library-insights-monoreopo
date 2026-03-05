import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth-context";
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

function StarSelector({ rating, onChange }: { rating: number; onChange: (r: number) => void }) {
  return (
    <View style={styles.starSelectorRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <TouchableOpacity key={i} onPress={() => onChange(i)} hitSlop={4}>
          <Text style={[styles.starSelectorText, i <= rating ? styles.starFilled : styles.starEmpty]}>
            {i <= rating ? "★" : "☆"}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ReviewCard({
  item,
  onBookPress,
  isMine,
  onEdit,
  onDelete,
}: {
  item: BookReview;
  onBookPress: (book: Book) => void;
  isMine?: boolean;
  onEdit?: (item: BookReview) => void;
  onDelete?: (item: BookReview) => void;
}) {
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
        {isMine && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => onEdit?.(item)}>
              <Ionicons name="create-outline" size={15} color="#818CF8" />
              <Text style={styles.actionBtnText}>수정</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => onDelete?.(item)}>
              <Ionicons name="trash-outline" size={15} color="#F87171" />
              <Text style={[styles.actionBtnText, { color: "#F87171" }]}>삭제</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

export default function ReviewsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"latest" | "mine">("latest");
  const [page, setPage] = useState(1);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  // Edit modal state
  const [editingReview, setEditingReview] = useState<BookReview | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editText, setEditText] = useState("");

  // 프로필에서 닉네임 조회
  const { data: userProfile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.profile(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading, isError } = useQuery<{ reviews: BookReview[]; total: number }>({
    queryKey: ["all-reviews"],
    queryFn: () => api.allReviews(1, 1000),
    staleTime: 0,
  });

  const { data: myReviewsData, isLoading: isMyLoading } = useQuery<BookReview[]>({
    queryKey: ["my-reviews", user?.id],
    queryFn: () => api.myReviews(user!.id),
    enabled: filter === "mine" && !!user,
    staleTime: 0,
  });

  const allReviews = data?.reviews ?? [];
  const myReviews = myReviewsData ?? [];

  const activeReviews = useMemo(() => {
    const source = filter === "mine" ? myReviews : allReviews;
    return [...source].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [allReviews, myReviews, filter]);

  const totalPages = Math.max(1, Math.ceil(activeReviews.length / PAGE_SIZE));
  const pageItems = activeReviews.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleFilterChange = (newFilter: "latest" | "mine") => {
    if (newFilter === "mine" && !user) {
      Alert.alert("로그인 필요", "내 한줄평을 보려면 로그인이 필요합니다.");
      return;
    }
    setFilter(newFilter);
    setPage(1);
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (isbn13: string) => api.deleteReview(isbn13),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["my-reviews"] });
    },
  });

  const handleDelete = useCallback((item: BookReview) => {
    Alert.alert("한줄평 삭제", `"${item.bookname}" 한줄평을 삭제하시겠습니까?`, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => deleteMutation.mutate(item.isbn13),
      },
    ]);
  }, [deleteMutation]);

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: (params: { review: BookReview; rating: number; text: string }) =>
      api.upsertReview({
        isbn13: params.review.isbn13,
        bookname: params.review.bookname,
        authors: params.review.authors,
        publisher: params.review.publisher,
        book_image_url: params.review.book_image_url,
        display_name:
          userProfile?.nickname ||
          (user as any)?.user_metadata?.name ||
          (user as any)?.email?.split("@")[0] ||
          "",
        rating: params.rating,
        review_text: params.text,
      }),
    onSuccess: () => {
      setEditingReview(null);
      queryClient.invalidateQueries({ queryKey: ["all-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["my-reviews"] });
    },
  });

  const handleEdit = useCallback((item: BookReview) => {
    setEditRating(item.rating);
    setEditText(item.review_text);
    setEditingReview(item);
  }, []);

  const handleEditSave = () => {
    if (!editingReview) return;
    const trimmed = editText.trim();
    if (!trimmed) {
      Alert.alert("오류", "한줄평을 입력해주세요.");
      return;
    }
    if (editRating === 0) {
      Alert.alert("오류", "별점을 선택해주세요.");
      return;
    }
    editMutation.mutate({ review: editingReview, rating: editRating, text: trimmed });
  };

  const displayCount = filter === "mine" ? myReviews.length : allReviews.length;
  const showLoading = filter === "mine" ? isMyLoading : isLoading;

  return (
    <AppBackground>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>독자 한줄평</Text>
          {displayCount > 0 && (
            <Text style={styles.headerCount}>{displayCount}개</Text>
          )}
        </View>

        {/* 필터 탭 */}
        <View style={styles.sortRow}>
          <TouchableOpacity
            style={[styles.sortBtn, filter === "latest" && styles.sortBtnActive]}
            onPress={() => handleFilterChange("latest")}
          >
            <Text style={[styles.sortBtnText, filter === "latest" && styles.sortBtnTextActive]}>
              최신순
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortBtn, filter === "mine" && styles.sortBtnActive]}
            onPress={() => handleFilterChange("mine")}
          >
            <Text style={[styles.sortBtnText, filter === "mine" && styles.sortBtnTextActive]}>
              내 한줄평
            </Text>
          </TouchableOpacity>
        </View>

        {/* 목록 */}
        {showLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingText}>한줄평 불러오는 중...</Text>
          </View>
        ) : isError && filter === "latest" ? (
          <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={36} color="#64748B" />
            <Text style={styles.emptyText}>한줄평을 불러오지 못했습니다.</Text>
          </View>
        ) : activeReviews.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>
              {filter === "mine" ? "아직 작성한 한줄평이 없습니다." : "아직 작성된 한줄평이 없습니다."}
            </Text>
          </View>
        ) : (
          <>
            <FlatList
              data={pageItems}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ReviewCard
                  item={item}
                  onBookPress={setSelectedBook}
                  isMine={filter === "mine"}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
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

      {/* Edit Modal */}
      <Modal visible={!!editingReview} transparent animationType="fade" onRequestClose={() => setEditingReview(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditingReview(null)}>
            <TouchableOpacity activeOpacity={1} style={styles.modalContent} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>한줄평 수정</Text>
                <TouchableOpacity onPress={() => setEditingReview(null)}>
                  <Ionicons name="close" size={22} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalBookName} numberOfLines={1}>
                {editingReview?.bookname}
              </Text>

              <StarSelector rating={editRating} onChange={setEditRating} />

              <TextInput
                style={styles.modalTextInput}
                value={editText}
                onChangeText={(t) => setEditText(t.slice(0, 100))}
                placeholder="한줄평을 입력하세요"
                placeholderTextColor="#475569"
                multiline
                maxLength={100}
              />
              <Text style={styles.modalCharCount}>{editText.length}/100</Text>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setEditingReview(null)}
                >
                  <Text style={styles.modalCancelBtnText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn, editMutation.isPending && { opacity: 0.6 }]}
                  onPress={handleEditSave}
                  disabled={editMutation.isPending}
                >
                  <Text style={styles.modalSaveBtnText}>
                    {editMutation.isPending ? "저장 중..." : "저장"}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
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

  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#1E293B",
  },
  actionBtnText: { fontSize: 12, fontWeight: "600", color: "#818CF8" },

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

  // Edit Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#0F172A",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#F1F5F9" },
  modalBookName: { fontSize: 13, color: "#94A3B8", marginBottom: 12 },
  starSelectorRow: { flexDirection: "row", gap: 6, marginBottom: 12 },
  starSelectorText: { fontSize: 28 },
  starFilled: { color: "#FBBF24" },
  starEmpty: { color: "#334155" },
  modalTextInput: {
    backgroundColor: "#1E293B",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    padding: 12,
    color: "#F1F5F9",
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalCharCount: { fontSize: 11, color: "#475569", textAlign: "right", marginTop: 4, marginBottom: 16 },
  modalBtnRow: { flexDirection: "row", gap: 10 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
  },
  modalCancelBtnText: { fontSize: 14, fontWeight: "600", color: "#94A3B8" },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#4F46E5",
    alignItems: "center",
  },
  modalSaveBtnText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
});
