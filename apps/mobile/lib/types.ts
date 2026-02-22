export interface Book {
  isbn13: string;
  isbn?: string;
  bookname: string;
  authors: string;
  publisher: string;
  publication_year: string;
  bookImageURL: string;
  description?: string;
  class_nm?: string;
  loan_count?: string | number;
  ranking?: number;
  addition_symbol?: string;
}

export interface Library {
  libCode: string;
  libName: string;
  address: string;
  tel?: string;
  latitude: string;
  longitude: string;
  homepage?: string;
  operatingTime?: string;
}

export interface Bookmark {
  isbn13: string;
  bookname: string;
  authors: string;
  publisher: string;
  publication_year: string;
  book_image_url: string;
  created_at?: string;
}

export interface AIInsight {
  summary: string;
  keyMessage: string;
  recommendFor: string;
  difficulty: string;
}

export interface AISearchResult {
  mode: "ai-only" | "no-gps" | "full";
  seedBook: Book;
  recommendations: Book[];
  regions?: string[];
}

export interface MonthlyRecommend {
  keyword: string;
  month: string;
  book: Book;
}

export interface UserProfile {
  id: string;
  birth_date: string | null;
  gender: string | null;
  region_code: string | null;
  region_name: string | null;
  sub_region_code: string | null;
  sub_region_name: string | null;
  avatar_url: string | null;
}
