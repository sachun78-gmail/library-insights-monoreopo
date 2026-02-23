import React, { useState, useEffect } from "react";
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
import { BookCard } from "../../components/BookCard";
import { BookDetailSheet } from "../../components/BookDetailSheet";
import { AppBackground } from "../../components/AppBackground";
import type { Book, AISearchResult } from "../../lib/types";

type SearchType = "title" | "author";

export default function SearchScreen() {
  // 홈 화면에서 전달된 검색어/타입/AI 모드 파라미터
  const { q, type: typeParam, ai: aiParam } = useLocalSearchParams<{
    q?: string;
    type?: string;
    ai?: string;
  }>();

  const [keyword, setKeyword] = useState(q ?? "");
  const [submittedKeyword, setSubmittedKeyword] = useState(q ?? "");
  const [searchType, setSearchType] = useState<SearchType>(
    typeParam === "author" ? "author" : "title"
  );
  const [aiMode, setAiMode] = useState(aiParam === "1");
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  // 홈에서 새 파라미터로 이동할 때 상태 동기화
  useEffect(() => {
    if (q !== undefined) {
      setKeyword(q);
      setSubmittedKeyword(q);
    }
    if (typeParam === "author") setSearchType("author");
    else if (typeParam === "title") setSearchType("title");
    if (aiParam === "1") setAiMode(true);
  }, [q, typeParam, aiParam]);

  // Regular infinite search
  const {
    data: searchData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isSearchLoading,
  } = useSearch(submittedKeyword, searchType, !aiMode);

  // AI search (runs only in AI mode)
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
        // GPS unavailable – server handles no-gps mode
      }
      return api.aiSearch(submittedKeyword, lat, lon);
    },
    enabled: aiMode && submittedKeyword.length > 0,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const books: Book[] = aiMode
    ? [
        ...(aiData?.recommendations ?? []),
        ...(aiData?.seedBook ? [aiData.seedBook] : []),
      ]
    : (searchData?.pages.flatMap((p) => p.books) ?? []);

  const isLoading = aiMode ? isAiLoading : isSearchLoading;
  const hasResults = books.length > 0;
  const hasSearched = submittedKeyword.length > 0;

  const handleSearch = () => {
    const trimmed = keyword.trim();
    if (trimmed) setSubmittedKeyword(trimmed);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#071426" }}>
      <AppBackground>
      {/* Search Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#1E293B" }}>
        <Text className="text-xl font-bold text-slate-100 mb-3">검색</Text>

        {/* Input row */}
        <View className="flex-row gap-2 mb-3">
          <View className="flex-1 flex-row items-center bg-slate-700 rounded-xl px-3">
            <Ionicons name="search-outline" size={18} color="#475569" />
            <TextInput
              className="flex-1 ml-2 text-sm text-slate-100 py-3"
              placeholder="도서명 또는 저자를 입력하세요"
              placeholderTextColor="#475569"
              value={keyword}
              onChangeText={setKeyword}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {keyword.length > 0 && (
              <TouchableOpacity onPress={() => setKeyword("")}>
                <Ionicons name="close-circle" size={18} color="#475569" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={handleSearch}
            className="bg-indigo-600 rounded-xl px-4 items-center justify-center"
          >
            <Text className="text-white text-sm font-semibold">검색</Text>
          </TouchableOpacity>
        </View>

        {/* Type selector + AI toggle */}
        <View className="flex-row items-center justify-between">
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
                  {type === "title" ? "도서명" : "저자명"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="flex-row items-center gap-2">
            <Text className="text-xs text-slate-300">AI 검색</Text>
            <Switch
              value={aiMode}
              onValueChange={setAiMode}
              trackColor={{ false: "#334155", true: "#4338CA" }}
              thumbColor={aiMode ? "#818CF8" : "#475569"}
            />
          </View>
        </View>
      </View>

      {/* AI mode banner */}
      {aiMode && (
        <View className="mx-4 mt-3 bg-indigo-950 rounded-xl p-3 flex-row items-center gap-2">
          <Ionicons name="sparkles" size={16} color="#818CF8" />
          <Text className="text-xs text-indigo-400 flex-1">
            AI가 위치 기반으로 소장 가능한 도서를 추천합니다
          </Text>
        </View>
      )}

      {/* States */}
      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#818CF8" />
          <Text className="text-sm text-slate-400 mt-3">
            {aiMode ? "AI가 분석 중입니다..." : "검색 중..."}
          </Text>
        </View>
      )}

      {!isLoading && !hasSearched && (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="search-outline" size={52} color="#334155" />
          <Text className="text-slate-500 mt-3 text-sm">
            검색어를 입력해주세요
          </Text>
        </View>
      )}

      {!isLoading && hasSearched && !hasResults && (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="book-outline" size={52} color="#334155" />
          <Text className="text-slate-500 mt-3 text-sm">
            검색 결과가 없습니다
          </Text>
          {isAiError && (
            <Text className="text-red-400 mt-1 text-xs">
              AI 검색 중 오류가 발생했습니다
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
            <BookCard book={item} onPress={setSelectedBook} />
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

      <BookDetailSheet
        book={selectedBook}
        onClose={() => setSelectedBook(null)}
      />
      </AppBackground>
    </SafeAreaView>
  );
}
