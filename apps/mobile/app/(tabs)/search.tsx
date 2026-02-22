import React, { useState } from "react";
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
import * as Location from "expo-location";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useSearch } from "../../hooks/useSearch";
import { BookCard } from "../../components/BookCard";
import { BookDetailSheet } from "../../components/BookDetailSheet";
import type { Book, AISearchResult } from "../../lib/types";

type SearchType = "title" | "author";

export default function SearchScreen() {
  const [keyword, setKeyword] = useState("");
  const [submittedKeyword, setSubmittedKeyword] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("title");
  const [aiMode, setAiMode] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

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
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Search Header */}
      <View className="px-4 pt-5 pb-3 bg-white border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-900 mb-3">검색</Text>

        {/* Input row */}
        <View className="flex-row gap-2 mb-3">
          <View className="flex-1 flex-row items-center bg-gray-100 rounded-xl px-3">
            <Ionicons name="search-outline" size={18} color="#9ca3af" />
            <TextInput
              className="flex-1 ml-2 text-sm text-gray-900 py-3"
              placeholder="도서명 또는 저자를 입력하세요"
              placeholderTextColor="#9ca3af"
              value={keyword}
              onChangeText={setKeyword}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {keyword.length > 0 && (
              <TouchableOpacity onPress={() => setKeyword("")}>
                <Ionicons name="close-circle" size={18} color="#9ca3af" />
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
                  searchType === type ? "bg-indigo-600" : "bg-gray-100"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    searchType === type ? "text-white" : "text-gray-600"
                  }`}
                >
                  {type === "title" ? "도서명" : "저자명"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="flex-row items-center gap-2">
            <Text className="text-xs text-gray-600">AI 검색</Text>
            <Switch
              value={aiMode}
              onValueChange={setAiMode}
              trackColor={{ false: "#e5e7eb", true: "#c7d2fe" }}
              thumbColor={aiMode ? "#6366f1" : "#d1d5db"}
            />
          </View>
        </View>
      </View>

      {/* AI mode banner */}
      {aiMode && (
        <View className="mx-4 mt-3 bg-indigo-50 rounded-xl p-3 flex-row items-center gap-2">
          <Ionicons name="sparkles" size={16} color="#6366f1" />
          <Text className="text-xs text-indigo-700 flex-1">
            AI가 위치 기반으로 소장 가능한 도서를 추천합니다
          </Text>
        </View>
      )}

      {/* States */}
      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#6366f1" />
          <Text className="text-sm text-gray-500 mt-3">
            {aiMode ? "AI가 분석 중입니다..." : "검색 중..."}
          </Text>
        </View>
      )}

      {!isLoading && !hasSearched && (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="search-outline" size={52} color="#d1d5db" />
          <Text className="text-gray-400 mt-3 text-sm">
            검색어를 입력해주세요
          </Text>
        </View>
      )}

      {!isLoading && hasSearched && !hasResults && (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="book-outline" size={52} color="#d1d5db" />
          <Text className="text-gray-400 mt-3 text-sm">
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
          contentContainerStyle={{ padding: 16 }}
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
                <ActivityIndicator size="small" color="#6366f1" />
              </View>
            ) : null
          }
        />
      )}

      <BookDetailSheet
        book={selectedBook}
        onClose={() => setSelectedBook(null)}
      />
    </SafeAreaView>
  );
}
