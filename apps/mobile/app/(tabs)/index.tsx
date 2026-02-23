import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRecommend } from "../../hooks/useRecommend";
import { useNewArrivals } from "../../hooks/useNewArrivals";
import { Carousel } from "../../components/Carousel";
import { BookDetailSheet } from "../../components/BookDetailSheet";
import { AppBackground } from "../../components/AppBackground";
import type { Book } from "../../lib/types";

type SearchType = "title" | "author";

const PLACEHOLDER = "https://via.placeholder.com/80x110?text=No+Image";

export default function HomeScreen() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("title");
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const {
    data: recommend,
    isLoading: isLoadingRecommend,
    isError: isRecommendError,
  } = useRecommend();

  const {
    data: newArrivals,
    isLoading: isLoadingArrivals,
    isError: isArrivalsError,
  } = useNewArrivals();

  const handleSearch = () => {
    const trimmed = keyword.trim();
    if (trimmed) {
      router.push({
        pathname: "/(tabs)/search",
        params: { q: trimmed, type: searchType },
      });
    }
  };

  const handleAISearch = () => {
    router.push({
      pathname: "/(tabs)/search",
      params: { q: keyword.trim(), ai: "1" },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <AppBackground>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── Hero Section ── */}
        <View style={styles.hero}>
          {/* Logo */}
          <View style={styles.logoRow}>
            <Ionicons name="book" size={22} color="#D97706" />
            <Text style={styles.logoText}>LibraryInsights</Text>
          </View>

          {/* Headline */}
          <Text style={styles.headline}>
            오늘 한국이 읽고 있는{"\n"}책을 발견하세요
          </Text>
          <Text style={styles.subtitle}>
            공공도서관 네트워크의 실시간 인사이트. 트렌드를 탐색하고 대출 가능
            여부를 확인하세요.
          </Text>

          {/* Type buttons + AI 추천 */}
          <View style={styles.typeRow}>
            <TouchableOpacity
              onPress={() => setSearchType("title")}
              style={[
                styles.typeBtn,
                searchType === "title" && styles.typeBtnActive,
              ]}
            >
              <Text style={styles.typeBtnText}>도서명</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSearchType("author")}
              style={[
                styles.typeBtn,
                searchType === "author" && styles.typeBtnActive,
              ]}
            >
              <Text style={styles.typeBtnText}>저자명</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleAISearch}
              style={styles.aiBtn}
            >
              <Ionicons name="sparkles" size={13} color="#D1D5DB" />
              <Text style={styles.aiBtnText}>AI 추천</Text>
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={styles.searchRow}>
            <View style={styles.inputWrap}>
              <Ionicons name="search-outline" size={16} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                placeholder={
                  searchType === "title"
                    ? "도서명을 입력하세요..."
                    : "저자명을 입력하세요..."
                }
                placeholderTextColor="#9CA3AF"
                value={keyword}
                onChangeText={setKeyword}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              {keyword.length > 0 && (
                <TouchableOpacity onPress={() => setKeyword("")}>
                  <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
              <Text style={styles.searchBtnText}>검색</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 이달의 추천 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>이달의 추천</Text>

          {isLoadingRecommend && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#D97706" />
            </View>
          )}

          {!isLoadingRecommend && isRecommendError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>추천 데이터를 불러오지 못했습니다</Text>
            </View>
          )}

          {!isLoadingRecommend && !isRecommendError && recommend?.book && (
            <TouchableOpacity
              onPress={() => setSelectedBook(recommend.book)}
              style={styles.recommendCard}
              activeOpacity={0.85}
            >
              <Image
                source={{ uri: recommend.book.bookImageURL || PLACEHOLDER }}
                style={styles.recommendImage}
                resizeMode="cover"
              />
              <View style={styles.recommendInfo}>
                <View style={styles.keywordBadge}>
                  <Text style={styles.keywordText}>#{recommend.keyword}</Text>
                </View>
                <Text style={styles.recommendTitle} numberOfLines={3}>
                  {recommend.book.bookname}
                </Text>
                <Text style={styles.recommendAuthor} numberOfLines={1}>
                  {recommend.book.authors}
                </Text>
                {recommend.book.publication_year && (
                  <Text style={styles.recommendYear}>
                    {recommend.book.publication_year}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ── 신착 도서 ── */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionTitle, styles.sectionTitleHorizontal]}>
            신착 도서
          </Text>

          {isLoadingArrivals && (
            <View style={[styles.loadingBox, { height: 180 }]}>
              <ActivityIndicator size="small" color="#D97706" />
            </View>
          )}

          {!isLoadingArrivals && isArrivalsError && (
            <Text style={[styles.errorText, { paddingHorizontal: 20 }]}>
              신착 도서를 불러오지 못했습니다
            </Text>
          )}

          {!isLoadingArrivals && !isArrivalsError && (
            <Carousel books={newArrivals ?? []} onPress={setSelectedBook} />
          )}
        </View>
      </ScrollView>
      </AppBackground>

      <BookDetailSheet
        book={selectedBook}
        onClose={() => setSelectedBook(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#071426" },

  scrollContent: { paddingBottom: 100 },

  /* Hero */
  hero: {
    backgroundColor: "transparent",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  logoRow: { flexDirection: "row", alignItems: "center", marginBottom: 28 },
  logoText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginLeft: 8,
  },
  headline: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#FFFFFF",
    lineHeight: 36,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 12,
    color: "#9CA3AF",
    lineHeight: 18,
    marginBottom: 24,
  },

  /* Type buttons */
  typeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  typeBtn: {
    backgroundColor: "#2D2413",
    borderWidth: 1,
    borderColor: "#3D3020",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  typeBtnActive: {
    backgroundColor: "#3D3720",
    borderColor: "#6B6040",
  },
  typeBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "500" },
  aiBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#6B7280",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  aiBtnText: { color: "#D1D5DB", fontSize: 13 },

  /* Search bar */
  searchRow: { flexDirection: "row", gap: 8 },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    paddingVertical: 12,
    marginLeft: 8,
  },
  searchBtn: {
    backgroundColor: "#D97706",
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },

  /* Sections */
  section: { paddingHorizontal: 20, marginTop: 8, marginBottom: 0 },
  sectionBlock: { marginTop: 28, marginBottom: 16 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#F1F5F9",
    marginBottom: 14,
  },
  sectionTitleHorizontal: { paddingHorizontal: 20 },
  loadingBox: { height: 100, alignItems: "center", justifyContent: "center" },
  errorBox: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  errorText: { fontSize: 12, color: "#F87171" },

  /* Recommend card */
  recommendCard: {
    backgroundColor: "#92400E",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  recommendImage: { width: 76, height: 108, borderRadius: 8 },
  recommendInfo: { flex: 1 },
  keywordBadge: {
    backgroundColor: "#B45309",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  keywordText: { fontSize: 11, color: "#FDE68A", fontWeight: "500" },
  recommendTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
    lineHeight: 22,
  },
  recommendAuthor: { fontSize: 12, color: "#FCD34D" },
  recommendYear: { fontSize: 11, color: "#D97706", marginTop: 4 },
});
