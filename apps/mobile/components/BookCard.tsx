import React, { useState } from "react";
import { TouchableOpacity, Image, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Book } from "../lib/types";

interface Props {
  book: Book;
  onPress: (book: Book) => void;
  rank?: number;
  aiOnly?: boolean;
}

function BookCover({ uri, width = 52, height = 74 }: { uri: string; width?: number; height?: number }) {
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View
        style={{ width, height, borderRadius: 6, backgroundColor: "#1E293B", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#334155" }}
      >
        <Ionicons name="book-outline" size={22} color="#475569" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={{ width, height, borderRadius: 6 }}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

export function BookCard({ book, onPress, rank, aiOnly }: Props) {
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
      <BookCover uri={book.bookImageURL} />
      <View className="flex-1 justify-center">
        {aiOnly && (
          <View className="self-start bg-indigo-950 border border-indigo-700 rounded px-1.5 py-0.5 mb-1">
            <Text className="text-indigo-300" style={{ fontSize: 10 }}>AI 추천</Text>
          </View>
        )}
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
