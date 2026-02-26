import React, { useState } from "react";
import { FlatList, Image, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Book } from "../lib/types";

interface Props {
  books: Book[];
  onPress: (book: Book) => void;
}

const CARD_WIDTH = 130;
const CARD_GAP = 12;
const H_PADDING = 20;
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;

function CarouselCover({ uri }: { uri: string }) {
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View
        style={{ width: CARD_WIDTH, height: 180, borderRadius: 10, backgroundColor: "#1E293B", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#334155" }}
      >
        <Ionicons name="book-outline" size={36} color="#475569" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={{ width: CARD_WIDTH, height: 180, borderRadius: 10 }}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

export function Carousel({ books, onPress }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (books.length === 0) return null;

  const handleMomentumEnd = (
    offsetX: number,
    viewportWidth: number,
    contentWidth: number
  ) => {
    const isAtEnd = offsetX + viewportWidth >= contentWidth - 8;
    if (isAtEnd) {
      setActiveIndex(books.length - 1);
      return;
    }

    const next = Math.round(offsetX / SNAP_INTERVAL);
    const clamped = Math.max(0, Math.min(books.length - 1, next));
    setActiveIndex(clamped);
  };

  return (
    <View>
      <FlatList
        data={books}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, i) => `${item.isbn13}-${i}`}
        contentContainerStyle={{ paddingHorizontal: H_PADDING, gap: CARD_GAP }}
        snapToInterval={SNAP_INTERVAL}
        decelerationRate="fast"
        snapToAlignment="start"
        nestedScrollEnabled
        onMomentumScrollEnd={(e) =>
          handleMomentumEnd(
            e.nativeEvent.contentOffset.x,
            e.nativeEvent.layoutMeasurement.width,
            e.nativeEvent.contentSize.width
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onPress(item)}
            style={{ width: CARD_WIDTH }}
          >
            <CarouselCover uri={item.bookImageURL} />
            <Text
              numberOfLines={2}
              style={{
                fontSize: 12,
                marginTop: 6,
                color: "#CBD5E1",
                fontWeight: "500",
                lineHeight: 16,
              }}
            >
              {item.bookname}
            </Text>
            <Text
              numberOfLines={1}
              style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}
            >
              {item.authors}
            </Text>
          </Pressable>
        )}
      />

      {books.length > 1 && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: 6,
            marginTop: 10,
          }}
        >
          {books.map((_, index) => (
            <View
              key={`indicator-${index}`}
              style={{
                width: index === activeIndex ? 18 : 6,
                height: 6,
                borderRadius: 999,
                backgroundColor: index === activeIndex ? "#60A5FA" : "rgba(148,163,184,0.45)",
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
