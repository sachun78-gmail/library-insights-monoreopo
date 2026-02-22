import React from "react";
import {
  Modal,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Book, AIInsight } from "../lib/types";

interface Props {
  book: Book | null;
  onClose: () => void;
}

const PLACEHOLDER = "https://via.placeholder.com/80x110?text=No+Image";

export function BookDetailSheet({ book, onClose }: Props) {
  const { data: insight, isLoading: isInsightLoading } = useQuery<AIInsight>({
    queryKey: ["ai-insight", book?.bookname],
    queryFn: () => api.bookAIInsight(book!.bookname, book?.authors),
    enabled: !!book,
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    retry: false,
  });

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

      <View
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl"
        style={{ maxHeight: "85%" }}
      >
        {/* Handle bar */}
        <View className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-1" />

        <ScrollView
          className="px-5 pb-8"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {book && (
            <>
              {/* Book header */}
              <View className="flex-row gap-4 mt-3 mb-5">
                <Image
                  source={{ uri: book.bookImageURL || PLACEHOLDER }}
                  style={{ width: 80, height: 110, borderRadius: 8 }}
                  resizeMode="cover"
                />
                <View className="flex-1">
                  <Text
                    className="text-base font-bold text-gray-900 mb-1"
                    numberOfLines={4}
                  >
                    {book.bookname}
                  </Text>
                  <Text className="text-sm text-gray-600 mb-1">
                    {book.authors}
                  </Text>
                  <Text className="text-xs text-gray-400">
                    {book.publisher}
                    {book.publication_year ? ` · ${book.publication_year}` : ""}
                  </Text>
                  {book.class_nm && (
                    <View className="mt-2 bg-gray-100 rounded-md px-2 py-1 self-start">
                      <Text className="text-xs text-gray-500">
                        {book.class_nm}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* AI Insight */}
              {isInsightLoading && (
                <View className="py-4 items-center">
                  <ActivityIndicator size="small" color="#6366f1" />
                  <Text className="text-xs text-gray-400 mt-2">
                    AI 분석 중...
                  </Text>
                </View>
              )}

              {insight && (
                <View className="bg-indigo-50 rounded-2xl p-4 mb-4">
                  <Text className="text-xs font-semibold text-indigo-600 mb-2">
                    ✨ AI 도서 인사이트
                  </Text>
                  <Text className="text-sm text-gray-700 leading-relaxed mb-3">
                    {insight.summary}
                  </Text>
                  <View className="flex-row gap-2 mb-2">
                    <View className="flex-1 bg-white rounded-xl p-3">
                      <Text className="text-xs text-gray-400 mb-1">
                        핵심 메시지
                      </Text>
                      <Text className="text-xs text-gray-800">
                        {insight.keyMessage}
                      </Text>
                    </View>
                    <View className="flex-1 bg-white rounded-xl p-3">
                      <Text className="text-xs text-gray-400 mb-1">
                        추천 대상
                      </Text>
                      <Text className="text-xs text-gray-800">
                        {insight.recommendFor}
                      </Text>
                    </View>
                  </View>
                  <View className="bg-white rounded-xl p-3">
                    <Text className="text-xs text-gray-400 mb-1">난이도</Text>
                    <Text className="text-xs text-gray-800">
                      {insight.difficulty}
                    </Text>
                  </View>
                </View>
              )}

              {/* Book description */}
              {book.description && (
                <View className="mb-6">
                  <Text className="text-xs font-semibold text-gray-500 mb-2">
                    책 소개
                  </Text>
                  <Text className="text-sm text-gray-700 leading-relaxed">
                    {book.description}
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>

        <TouchableOpacity
          onPress={onClose}
          className="mx-5 mb-8 mt-2 bg-gray-100 rounded-2xl py-3 items-center"
        >
          <Text className="text-sm font-medium text-gray-600">닫기</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
