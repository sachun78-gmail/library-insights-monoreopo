import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useSearch } from "../../hooks/useSearch";
import { t } from "../../lib/i18n";
import { BookCard } from "../../components/BookCard";
import { BookDetailSheet } from "../../components/BookDetailSheet";
import { AppBackground } from "../../components/AppBackground";
import type { Book, AISearchResult } from "../../lib/types";

type SearchType = "title" | "author";
type AIRecommendationItem =
  | Book
  | { book?: Book; nearbyLibCount?: number }
  | { title: string; author: string }
  | null
  | undefined;

function normalizeAiRecommendations(items: AIRecommendationItem[] | undefined): Book[] {
  if (!items) return [];
  return items
    .map((item) => {
      if (!item) return null;
      // mode: 'full' / 'no-gps' — { book, nearbyLibCount }
      if ("book" in item && item.book) return item.book;
      // mode: 'full' / 'no-gps' — Book 객체 직접
      if ("bookname" in item) return item as Book;
      // mode: 'ai-only' — { title, author }
      if ("title" in item) {
        return {
          bookname: item.title,
          authors: item.author,
          isbn13: "",
          publisher: "",
          publication_year: "",
          bookImageURL: "",
        } as Book;
      }
      return null;
    })
    .filter((book): book is Book => !!book && !!book.bookname);
}

export default function SearchScreen() {
  const { q, type: typeParam, ai: aiParam } = useLocalSearchParams<{
    q?: string;
    type?: string;
    ai?: string;
  }>();

  const [keyword, setKeyword] = useState(q ?? "");
  const [submittedKeyword, setSubmittedKeyword] = useState(q ?? "");
  const [hasSubmitted, setHasSubmitted] = useState((q ?? "").trim().length > 0);
  const [searchType, setSearchType] = useState<SearchType>(
    typeParam === "author" ? "author" : "title"
  );
  const [aiMode, setAiMode] = useState(aiParam === "1");
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  useEffect(() => {
    setKeyword(q ?? "");
    setSubmittedKeyword(q ?? "");
    setHasSubmitted((q ?? "").trim().length > 0);
    setSearchType(typeParam === "author" ? "author" : "title");
    setAiMode(aiParam === "1");
  }, [q, typeParam, aiParam]);

  const {
    data: searchData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isSearchLoading,
  } = useSearch(submittedKeyword, searchType, !aiMode && hasSubmitted);

  const {
    data: aiData,
    isLoading: isAiLoading,
    isError: isAiError,
  } = useQuery<AISearchResult>({
    queryKey: ["ai-search", submittedKeyword],
    queryFn: async () => {
      let lat: number | undefined;
      let lon: number | undefined;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = loc.coords.latitude;
          lon = loc.coords.longitude;
        }
      } catch {
        // no-op: server supports no-gps mode
      }

      return api.aiSearch(submittedKeyword, lat, lon);
    },
    enabled: aiMode && hasSubmitted && submittedKeyword.trim().length > 0,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (typeof __DEV__ !== "undefined" && __DEV__ && aiData) {
      console.log("[AI][RAW]", aiData);
      console.log("[AI][SEED]", aiData.seedBook);
      console.log("[AI][RECOMMENDATIONS]", aiData.recommendations);
    }
  }, [aiData]);

  const [aiBooks, setAiBooks] = useState<Book[]>([]);

  useEffect(() => {
    if (!aiMode || !aiData) {
      setAiBooks([]);
      return;
    }

    const normalized = [
      ...normalizeAiRecommendations(aiData.recommendations as AIRecommendationItem[] | undefined),
      ...(aiData.seedBook ? [aiData.seedBook] : []),
    ];
    setAiBooks(normalized);

    // isbn 있고 이미지 없는 책들만 이미지 보강
    const missing = normalized.filter((b) => b.isbn13 && !b.bookImageURL);
    if (missing.length === 0) return;

    Promise.all(
      missing.map(async (book) => {
        try {
          const data = await api.search(book.isbn13, "isbn", 1, 1);
          const docs = data?.docs ?? data?.response?.docs ?? [];
          const doc = docs[0]?.doc ?? docs[0];
          if (doc?.bookImageURL) {
            book.bookImageURL = doc.bookImageURL;
          }
        } catch {
          // 무시
        }
      })
    ).then(() => {
      setAiBooks([...normalized]);
    });
  }, [aiData, aiMode]);

  const books: Book[] = aiMode
    ? aiBooks
    : (searchData?.pages.flatMap((p) => p.books) ?? []);

  const isLoading = aiMode ? isAiLoading : isSearchLoading;
  const hasResults = books.length > 0;
  const hasSearched = submittedKeyword.trim().length > 0;

  const handleSearch = () => {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    setSubmittedKeyword(trimmed);
    setHasSubmitted(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#071426" }}>
      <AppBackground>
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 20,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: "#1E293B",
            backgroundColor: "rgba(7,20,38,0.28)",
          }}
        >
          <Text className="text-xl font-bold text-slate-100 mb-3">{t("search_title")}</Text>

          <View className="flex-row gap-2 mb-3">
            <View className="flex-1 flex-row items-center bg-slate-700 rounded-xl px-3">
              <Ionicons name="search-outline" size={18} color="#94A3B8" />
              <TextInput
                className="flex-1 ml-2 text-sm text-slate-100 py-3"
                style={aiMode ? { fontSize: 11 } : undefined}
                multiline={false}
                numberOfLines={1}
                // @ts-ignore - iOS-only prop, not in current RN type definitions
                adjustsFontSizeToFit
                minimumFontScale={0.72}
                placeholder={
                  aiMode
                    ? t("search_placeholder_ai")
                    : searchType === "title"
                    ? t("search_placeholder_title")
                    : t("search_placeholder_author")
                }
                placeholderTextColor="#94A3B8"
                value={keyword}
                onChangeText={(text) => {
                  setKeyword(text);
                  setHasSubmitted(false);
                }}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              {keyword.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setKeyword("");
                    setHasSubmitted(false);
                  }}
                >
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              onPress={handleSearch}
              className="bg-indigo-600 rounded-xl px-4 items-center justify-center"
            >
              <Text className="text-white text-sm font-semibold">{aiMode ? "AI" : t("search_title")}</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center justify-between">
            {!aiMode ? (
              <View className="flex-row gap-2">
                {(["title", "author"] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setSearchType(type)}
                    className={`px-3 py-1.5 rounded-lg ${
                      searchType === type ? "bg-indigo-600" : "bg-slate-700"
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        searchType === type ? "text-white" : "text-slate-300"
                      }`}
                    >
                      {type === "title" ? t("home_type_title") : t("home_type_author")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View className="px-3 py-1.5 rounded-lg bg-indigo-950 border border-indigo-700">
                <Text className="text-xs text-indigo-300">{t("search_ai_mode_enabled")}</Text>
              </View>
            )}

            <View className="flex-row items-center gap-2">
              <Text className="text-xs text-slate-300">{t("search_ai_toggle")}</Text>
              <Switch
                value={aiMode}
                onValueChange={setAiMode}
                trackColor={{ false: "#334155", true: "#4338CA" }}
                thumbColor={aiMode ? "#A5B4FC" : "#64748B"}
              />
            </View>
          </View>
        </View>

        {aiMode && (
          <View className="mx-4 mt-3 bg-indigo-950/80 rounded-xl p-3 flex-row items-center gap-2 border border-indigo-800">
            <Ionicons name="sparkles" size={16} color="#A5B4FC" />
            <Text className="text-xs text-indigo-200 flex-1">
              {t("search_ai_banner")}
            </Text>
          </View>
        )}

        {isLoading && (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#818CF8" />
            <Text className="text-sm text-slate-400 mt-3">
              {aiMode ? t("search_loading_ai") : t("search_loading_normal")}
            </Text>
          </View>
        )}

        {!isLoading && !hasSearched && (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="search-outline" size={52} color="#334155" />
            <Text className="text-slate-400 mt-3 text-sm text-center">
              {aiMode
                ? t("search_empty_prompt_ai")
                : t("search_empty_prompt_normal")}
            </Text>
          </View>
        )}

        {!isLoading && hasSearched && !hasResults && (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="book-outline" size={52} color="#334155" />
            <Text className="text-slate-400 mt-3 text-sm text-center">{t("search_no_results")}</Text>
            {isAiError && (
              <Text className="text-red-400 mt-1 text-xs text-center">
                {t("search_ai_error")}
              </Text>
            )}
          </View>
        )}

        {!isLoading && hasResults && (
          <FlatList
            data={books}
            keyExtractor={(item, i) => `${item.isbn13 ?? i}-${i}`}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            renderItem={({ item }) => (
              <BookCard
                book={item}
                onPress={setSelectedBook}
                aiOnly={aiMode && aiData?.mode === "ai-only" && !item.isbn13}
              />
            )}
            onEndReached={() => {
              if (!aiMode && hasNextPage && !isFetchingNextPage) fetchNextPage();
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isFetchingNextPage ? (
                <View className="py-4 items-center">
                  <ActivityIndicator size="small" color="#D97706" />
                </View>
              ) : null
            }
          />
        )}

        <BookDetailSheet book={selectedBook} onClose={() => setSelectedBook(null)} />
      </AppBackground>
    </SafeAreaView>
  );
}
