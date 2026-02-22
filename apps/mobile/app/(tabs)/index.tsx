import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRecommend } from "../../hooks/useRecommend";
import { useNewArrivals } from "../../hooks/useNewArrivals";
import { Carousel } from "../../components/Carousel";
import { BookDetailSheet } from "../../components/BookDetailSheet";
import type { Book } from "../../lib/types";

const PLACEHOLDER = "https://via.placeholder.com/80x110?text=No+Image";

export default function HomeScreen() {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const {
    data: recommend,
    isLoading: isLoadingRecommend,
    isError: isRecommendError,
    isFetching: isFetchingRecommend,
  } = useRecommend();

  const {
    data: newArrivals,
    isLoading: isLoadingArrivals,
    isError: isArrivalsError,
  } = useNewArrivals();

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-5 pt-5 pb-2">
          <Text className="text-2xl font-bold text-gray-900">
            Library Insights
          </Text>
          <Text className="text-sm text-gray-500 mt-1">
            도서관 도서 탐색 앱
          </Text>
        </View>

        {/* 이달의 추천 */}
        <View className="px-5 mt-5 mb-6">
          <Text className="text-lg font-semibold text-gray-800 mb-3">
            이달의 추천
          </Text>

          {isLoadingRecommend && (
            <View className="h-32 items-center justify-center">
              <ActivityIndicator size="small" color="#6366f1" />
            </View>
          )}

          {!isLoadingRecommend && isRecommendError && (
            <View className="h-20 items-center justify-center bg-red-50 rounded-2xl">
              <Text className="text-xs text-red-400">추천 데이터를 불러오지 못했습니다</Text>
            </View>
          )}

          {!isLoadingRecommend && !isRecommendError && recommend?.book && (
            <TouchableOpacity
              onPress={() => setSelectedBook(recommend.book)}
              className="bg-indigo-600 rounded-2xl p-4 flex-row gap-4 items-center"
              activeOpacity={0.85}
            >
              <Image
                source={{ uri: recommend.book.bookImageURL || PLACEHOLDER }}
                style={{ width: 76, height: 108, borderRadius: 8 }}
                resizeMode="cover"
              />
              <View className="flex-1">
                <View className="bg-indigo-500 rounded-full px-2 py-0.5 self-start mb-2">
                  <Text className="text-xs text-white font-medium">
                    #{recommend.keyword}
                  </Text>
                </View>
                <Text
                  className="text-base font-bold text-white mb-1"
                  numberOfLines={3}
                >
                  {recommend.book.bookname}
                </Text>
                <Text className="text-xs text-indigo-200" numberOfLines={1}>
                  {recommend.book.authors}
                </Text>
                {recommend.book.publication_year && (
                  <Text className="text-xs text-indigo-300 mt-1">
                    {recommend.book.publication_year}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* 신착 도서 */}
        <View className="mb-8">
          <Text className="text-lg font-semibold text-gray-800 px-5 mb-3">
            신착 도서
          </Text>

          {isLoadingArrivals && (
            <View className="h-48 items-center justify-center">
              <ActivityIndicator size="small" color="#6366f1" />
            </View>
          )}

          {!isLoadingArrivals && isArrivalsError && (
            <Text className="text-red-400 text-xs px-5">
              신착 도서를 불러오지 못했습니다
            </Text>
          )}

          {!isLoadingArrivals && !isArrivalsError && (
            <Carousel books={newArrivals ?? []} onPress={setSelectedBook} />
          )}
        </View>
      </ScrollView>

      <BookDetailSheet
        book={selectedBook}
        onClose={() => setSelectedBook(null)}
      />
    </SafeAreaView>
  );
}
