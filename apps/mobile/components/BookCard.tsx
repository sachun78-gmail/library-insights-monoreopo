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
      className="flex-row gap-3 p-3 bg-slate-800 rounded-xl mb-2 border border-slate-700"
      style={{ shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 4, elevation: 1 }}
    >
      {rank !== undefined && (
        <View className="w-6 items-center justify-center">
          <Text
            className={`text-sm font-bold ${rank <= 3 ? "text-indigo-400" : "text-slate-500"}`}
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
          className="text-sm font-semibold text-slate-100 mb-1"
          numberOfLines={2}
        >
          {book.bookname}
        </Text>
        <Text className="text-xs text-slate-400 mb-1" numberOfLines={1}>
          {book.authors}
        </Text>
        <Text className="text-xs text-slate-500" numberOfLines={1}>
          {book.publisher}
          {book.publication_year ? ` · ${book.publication_year}` : ""}
        </Text>
        {book.loan_count != null && (
          <Text className="text-xs text-indigo-400 mt-1">
            대출 {book.loan_count}회
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}
