import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { BookDetailSheet } from "../../components/BookDetailSheet";
import { api } from "../../lib/api";
import type { Book, Bookmark } from "../../lib/types";

function bookmarkToBook(b: Bookmark): Book {
  return {
    isbn13: b.isbn13,
    bookname: b.bookname,
    authors: b.authors,
    publisher: b.publisher,
    publication_year: b.publication_year || "",
    bookImageURL: b.book_image_url,
  };
}

export default function BookDetailRoute() {
  const { isbn13 } = useLocalSearchParams<{ isbn13: string }>();
  const router = useRouter();

  // 찜 목록에서 도서 정보 조회
  const { data: bookmarks, isLoading } = useQuery<Bookmark[]>({
    queryKey: ["bookmarks"],
    queryFn: api.bookmarks,
  });

  const bookmarkMatch = bookmarks?.find((b) => b.isbn13 === isbn13);
  const book: Book | null = bookmarkMatch ? bookmarkToBook(bookmarkMatch) : null;

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2D6A4F" />
      </View>
    );
  }

  return (
    <BookDetailSheet
      book={book}
      onClose={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
});
