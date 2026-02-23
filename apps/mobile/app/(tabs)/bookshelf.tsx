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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth-context";
import { api } from "../../lib/api";
import { BookDetailSheet } from "../../components/BookDetailSheet";
import { AppBackground } from "../../components/AppBackground";
import type { Bookmark, Book } from "../../lib/types";

const PLACEHOLDER = "https://via.placeholder.com/52x74?text=No";

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

  const { data: bookmarks, isLoading } = useQuery<Bookmark[]>({
    queryKey: ["bookmarks", user?.id],
    queryFn: () => api.bookmarks(user!.id),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const removeMutation = useMutation({
    mutationFn: ({ isbn13 }: { isbn13: string }) =>
      api.removeBookmark(user!.id, isbn13),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["bookmarks", user?.id] }),
  });

  const handleRemove = (isbn13: string, bookname: string) => {
    Alert.alert("찜 해제", `'${bookname}'을(를) 서재에서 제거할까요?`, [
      { text: "취소", style: "cancel" },
      {
        text: "제거",
        style: "destructive",
        onPress: () => removeMutation.mutate({ isbn13 }),
      },
    ]);
  };

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
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.push("/login")}
          >
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
        <Text style={styles.headerTitle}>내 서재</Text>
        <Text style={styles.headerCount}>
          {bookmarks?.length ?? 0}권
        </Text>
      </View>

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

      {!isLoading && bookmarks && bookmarks.length > 0 && (
        <FlatList
          data={bookmarks}
          keyExtractor={(item) => item.isbn13}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => setSelectedBook(bookmarkToBook(item))}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: item.book_image_url || PLACEHOLDER }}
                style={styles.cardImage}
                resizeMode="cover"
              />
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
              </View>
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => handleRemove(item.isbn13, item.bookname)}
              >
                <Ionicons name="heart" size={22} color="#DC2626" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
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
  headerCount: { fontSize: 14, color: "#94A3B8" },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#F1F5F9", marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#64748B", textAlign: "center", lineHeight: 20 },
  loginBtn: {
    marginTop: 24,
    backgroundColor: "#D97706",
    paddingHorizontal: 32,
    paddingVertical: 13,
    borderRadius: 12,
  },
  loginBtnText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
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
  cardInfo: { flex: 1, marginHorizontal: 12 },
  cardTitle: { fontSize: 14, fontWeight: "600", color: "#F1F5F9", marginBottom: 4, lineHeight: 20 },
  cardAuthor: { fontSize: 12, color: "#94A3B8", marginBottom: 2 },
  cardPublisher: { fontSize: 11, color: "#64748B" },
  removeBtn: { padding: 6 },
});
