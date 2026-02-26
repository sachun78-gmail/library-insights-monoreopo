import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
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
import { useAuth } from "../../lib/auth-context";
import { t } from "../../lib/i18n";
import { Carousel } from "../../components/Carousel";
import { BookDetailSheet } from "../../components/BookDetailSheet";
import { AppBackground } from "../../components/AppBackground";
import type { Book } from "../../lib/types";

type SearchType = "title" | "author";

const PLACEHOLDER = "https://via.placeholder.com/80x110?text=No+Image";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const inputRef = useRef<TextInput>(null);

  const [keyword, setKeyword] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("title");
  const [isAiMode, setIsAiMode] = useState(false);
  const [pendingAiModeAfterLogin, setPendingAiModeAfterLogin] = useState(false);
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

  const focusSearchInput = () => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 120);
  };

  const activateAiMode = () => {
    setKeyword("");
    setIsAiMode(true);
    focusSearchInput();
  };

  useEffect(() => {
    if (pendingAiModeAfterLogin && user) {
      setPendingAiModeAfterLogin(false);
      activateAiMode();
    }
  }, [pendingAiModeAfterLogin, user]);

  const handleSearch = () => {
    const trimmed = keyword.trim();
    if (!trimmed) return;

    router.push(
      isAiMode
        ? {
            pathname: "/(tabs)/search",
            params: { q: trimmed, ai: "1" },
          }
        : {
            pathname: "/(tabs)/search",
            params: { q: trimmed, type: searchType },
          }
    );
  };

  const handleAISearchPress = () => {
    if (isAiMode) {
      setKeyword("");
      setIsAiMode(false);
      setSearchType("title");
      return;
    }

    if (!user) {
      Alert.alert(t("home_login_required"), t("home_login_ai_desc"), [
        { text: t("common_cancel"), style: "cancel" },
        {
          text: t("common_login"),
          onPress: () => {
            setPendingAiModeAfterLogin(true);
            router.push("/login");
          },
        },
      ]);
      return;
    }

    activateAiMode();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <AppBackground>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.hero}>
            <View style={styles.logoRow}>
              <Ionicons name="book" size={22} color="#D97706" />
              <Text style={styles.logoText}>LibraryInsights</Text>
            </View>

            <Text style={styles.headline}>{t("home_headline")}</Text>
            <Text style={styles.subtitle}>
              {t("home_subtitle")}
            </Text>

            <View style={styles.typeRow}>
              {!isAiMode && (
                <>
                  <TouchableOpacity
                    onPress={() => {
                      setKeyword("");
                      setIsAiMode(false);
                      setSearchType("title");
                    }}
                    style={[styles.typeBtn, searchType === "title" && styles.typeBtnActive]}
                  >
                    <Text style={styles.typeBtnText}>{t("home_type_title")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setKeyword("");
                      setIsAiMode(false);
                      setSearchType("author");
                    }}
                    style={[styles.typeBtn, searchType === "author" && styles.typeBtnActive]}
                  >
                    <Text style={styles.typeBtnText}>{t("home_type_author")}</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                onPress={handleAISearchPress}
                style={[styles.aiBtn, isAiMode && styles.aiBtnActive, isAiMode && styles.aiBtnSolo]}
              >
                <Ionicons name="sparkles" size={13} color={isAiMode ? "#E0E7FF" : "#D1D5DB"} />
                <Text style={[styles.aiBtnText, isAiMode && styles.aiBtnTextActive]}>
                  {t("home_ai_recommend")}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchRow}>
              <View style={styles.inputWrap}>
                <Ionicons name="search-outline" size={16} color="#9CA3AF" />
                <TextInput
                  ref={inputRef}
                  style={[styles.input, isAiMode && styles.inputAiMode]}
                  multiline={false}
                  numberOfLines={1}
                  // @ts-ignore - iOS-only prop, not in current RN type definitions
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                  placeholder={
                    isAiMode
                      ? t("home_placeholder_ai")
                      : searchType === "title"
                      ? t("home_placeholder_title")
                      : t("home_placeholder_author")
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
                <Text style={styles.searchBtnText}>{isAiMode ? "AI" : t("home_btn_search")}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("home_monthly_pick")}</Text>

            {isLoadingRecommend && (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#D97706" />
              </View>
            )}

            {!isLoadingRecommend && isRecommendError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{t("home_monthly_pick_error")}</Text>
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
                    <Text style={styles.recommendYear}>{recommend.book.publication_year}</Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionTitle, styles.sectionTitleHorizontal]}>{t("home_new_arrivals")}</Text>

            {isLoadingArrivals && (
              <View style={[styles.loadingBox, { height: 180 }]}>
                <ActivityIndicator size="small" color="#D97706" />
              </View>
            )}

            {!isLoadingArrivals && isArrivalsError && (
              <Text style={[styles.errorText, { paddingHorizontal: 20 }]}>{t("home_new_arrivals_error")}</Text>
            )}

            {!isLoadingArrivals && !isArrivalsError && (
              <Carousel books={newArrivals ?? []} onPress={setSelectedBook} />
            )}
          </View>
        </ScrollView>
      </AppBackground>

      <BookDetailSheet book={selectedBook} onClose={() => setSelectedBook(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#071426" },
  scrollContent: { paddingBottom: 100 },

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
    lineHeight: 34,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 12,
    color: "#9CA3AF",
    lineHeight: 18,
    marginBottom: 24,
  },

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
    backgroundColor: "transparent",
  },
  aiBtnActive: {
    backgroundColor: "rgba(79,70,229,0.28)",
    borderColor: "#818CF8",
  },
  aiBtnSolo: {
    marginLeft: 0,
  },
  aiBtnText: { color: "#D1D5DB", fontSize: 13 },
  aiBtnTextActive: { color: "#E0E7FF", fontWeight: "600" },

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
  inputAiMode: {
    fontSize: 11,
  },
  searchBtn: {
    backgroundColor: "#D97706",
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 64,
  },
  searchBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },

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
