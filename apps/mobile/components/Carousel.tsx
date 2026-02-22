import React from "react";
import { FlatList, Image, Text, TouchableOpacity, View } from "react-native";
import type { Book } from "../lib/types";

interface Props {
  books: Book[];
  onPress: (book: Book) => void;
}

const CARD_WIDTH = 130;
const PLACEHOLDER = "https://via.placeholder.com/130x180?text=No+Image";

export function Carousel({ books, onPress }: Props) {
  if (books.length === 0) return null;

  return (
    <FlatList
      data={books}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item, i) => `${item.isbn13}-${i}`}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => onPress(item)}
          style={{ width: CARD_WIDTH }}
        >
          <Image
            source={{ uri: item.bookImageURL || PLACEHOLDER }}
            style={{ width: CARD_WIDTH, height: 180, borderRadius: 10 }}
            resizeMode="cover"
          />
          <Text
            numberOfLines={2}
            style={{
              fontSize: 12,
              marginTop: 6,
              color: "#374151",
              fontWeight: "500",
              lineHeight: 16,
            }}
          >
            {item.bookname}
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}
          >
            {item.authors}
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}
