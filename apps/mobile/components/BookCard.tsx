import React from "react";
import { TouchableOpacity, Image, Text, View } from "react-native";
import type { Book } from "../lib/types";

interface Props {
  book: Book;
  onPress: (book: Book) => void;
  rank?: number;
}

const PLACEHOLDER = "https://via.placeholder.com/60x85?text=No+Image";

export function BookCard({ book, onPress, rank }: Props) {
  return (
    <TouchableOpacity
      onPress={() => onPress(book)}
      className="flex-row gap-3 p-3 bg-white rounded-xl mb-2 border border-gray-100"
      style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
    >
      {rank !== undefined && (
        <View className="w-6 items-center justify-center">
          <Text
            className={`text-sm font-bold ${rank <= 3 ? "text-indigo-600" : "text-gray-400"}`}
          >
            {rank}
          </Text>
        </View>
      )}
      <Image
        source={{ uri: book.bookImageURL || PLACEHOLDER }}
        style={{ width: 52, height: 74, borderRadius: 6 }}
        resizeMode="cover"
      />
      <View className="flex-1 justify-center">
        <Text
          className="text-sm font-semibold text-gray-900 mb-1"
          numberOfLines={2}
        >
          {book.bookname}
        </Text>
        <Text className="text-xs text-gray-500 mb-1" numberOfLines={1}>
          {book.authors}
        </Text>
        <Text className="text-xs text-gray-400" numberOfLines={1}>
          {book.publisher}
          {book.publication_year ? ` · ${book.publication_year}` : ""}
        </Text>
        {book.loan_count != null && (
          <Text className="text-xs text-indigo-500 mt-1">
            대출 {book.loan_count}회
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}
