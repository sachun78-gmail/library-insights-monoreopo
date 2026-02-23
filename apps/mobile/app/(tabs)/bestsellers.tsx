import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useBestsellers, useHotTrend } from "../../hooks/useBestsellers";
import { BookCard } from "../../components/BookCard";
import { BookDetailSheet } from "../../components/BookDetailSheet";
import type { Book } from "../../lib/types";

type TabType = "popular" | "hot";

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

function getDateRange(days: number): { startDt: string; endDt: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return { startDt: formatDate(start), endDt: formatDate(end) };
}

const PERIOD_OPTIONS = [
  { label: "7일", value: "7" },
  { label: "14일", value: "14" },
  { label: "30일", value: "30" },
  { label: "90일", value: "90" },
];

const GENDER_OPTIONS = [
  { label: "전체", value: "" },
  { label: "남성", value: "1" },
  { label: "여성", value: "2" },
];

const AGE_OPTIONS = [
  { label: "전체", from: "", to: "" },
  { label: "10대", from: "10", to: "19" },
  { label: "20대", from: "20", to: "29" },
  { label: "30대", from: "30", to: "39" },
  { label: "40대", from: "40", to: "49" },
  { label: "50대+", from: "50", to: "59" },
];

const REGION_OPTIONS = [
  { code: "", name: "전국" },
  { code: "11", name: "서울" },
  { code: "21", name: "부산" },
  { code: "22", name: "대구" },
  { code: "23", name: "인천" },
  { code: "24", name: "광주" },
  { code: "25", name: "대전" },
  { code: "26", name: "울산" },
  { code: "29", name: "세종" },
  { code: "31", name: "경기" },
  { code: "32", name: "강원" },
  { code: "33", name: "충북" },
  { code: "34", name: "충남" },
  { code: "35", name: "전북" },
  { code: "36", name: "전남" },
  { code: "37", name: "경북" },
  { code: "38", name: "경남" },
  { code: "39", name: "제주" },
];

// --- Filter Modal ---

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  period: string;
  setPeriod: (v: string) => void;
  gender: string;
  setGender: (v: string) => void;
  ageFrom: string;
  setAgeFrom: (v: string) => void;
  ageTo: string;
  setAgeTo: (v: string) => void;
  region: string;
  setRegion: (v: string) => void;
}

function FilterModal({
  visible,
  onClose,
  period,
  setPeriod,
  gender,
  setGender,
  ageFrom,
  setAgeFrom,
  ageTo,
  setAgeTo,
  region,
  setRegion,
}: FilterModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
      >
        <View
          className="bg-white rounded-t-3xl px-5 pt-4"
          style={{ maxHeight: "80%", paddingBottom: 32 }}
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-gray-900">필터</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Period */}
            <Text className="text-sm font-semibold text-gray-700 mb-2">
              기간
            </Text>
            <View className="flex-row gap-2 mb-4">
              {PERIOD_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setPeriod(opt.value)}
                  className={`px-3 py-2 rounded-lg ${
                    period === opt.value ? "bg-indigo-600" : "bg-gray-100"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      period === opt.value ? "text-white" : "text-gray-600"
                    }`}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Gender */}
            <Text className="text-sm font-semibold text-gray-700 mb-2">
              성별
            </Text>
            <View className="flex-row gap-2 mb-4">
              {GENDER_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setGender(opt.value)}
                  className={`px-4 py-2 rounded-lg ${
                    gender === opt.value ? "bg-indigo-600" : "bg-gray-100"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      gender === opt.value ? "text-white" : "text-gray-600"
                    }`}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Age */}
            <Text className="text-sm font-semibold text-gray-700 mb-2">
              연령
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {AGE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.label}
                  onPress={() => {
                    setAgeFrom(opt.from);
                    setAgeTo(opt.to);
                  }}
                  className={`px-3 py-2 rounded-lg ${
                    ageFrom === opt.from && ageTo === opt.to
                      ? "bg-indigo-600"
                      : "bg-gray-100"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      ageFrom === opt.from && ageTo === opt.to
                        ? "text-white"
                        : "text-gray-600"
                    }`}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Region */}
            <Text className="text-sm font-semibold text-gray-700 mb-2">
              지역
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {REGION_OPTIONS.map((r) => (
                <TouchableOpacity
                  key={r.code}
                  onPress={() => setRegion(r.code)}
                  className={`px-3 py-2 rounded-lg ${
                    region === r.code ? "bg-indigo-600" : "bg-gray-100"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      region === r.code ? "text-white" : "text-gray-600"
                    }`}
                  >
                    {r.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={onClose}
              className="bg-indigo-600 rounded-2xl py-3 items-center mt-2 mb-2"
            >
              <Text className="text-white font-semibold">적용하기</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// --- Main Screen ---

export default function BestsellersScreen() {
  const [tab, setTab] = useState<TabType>("popular");
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);

  const [period, setPeriod] = useState("30");
  const [gender, setGender] = useState("");
  const [ageFrom, setAgeFrom] = useState("");
  const [ageTo, setAgeTo] = useState("");
  const [region, setRegion] = useState("");

  const { startDt, endDt } = getDateRange(parseInt(period, 10));

  const {
    data: popularBooks,
    isLoading: isLoadingPopular,
  } = useBestsellers({
    startDt,
    endDt,
    gender: gender || undefined,
    from_age: ageFrom || undefined,
    to_age: ageTo || undefined,
    region: region || undefined,
    pageSize: 30,
  });

  const { data: hotBooks = [], isLoading: isLoadingHot } = useHotTrend();

  const books: Book[] = tab === "popular" ? (popularBooks ?? []) : hotBooks;
  const isLoading = tab === "popular" ? isLoadingPopular : isLoadingHot;
  const hasFilters = !!(region || gender || ageFrom || ageTo || period !== "30");

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-5 pt-5 pb-3 bg-white border-b border-gray-100">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-xl font-bold text-gray-900">인기도서</Text>
          {tab === "popular" && (
            <TouchableOpacity
              onPress={() => setFilterVisible(true)}
              className={`flex-row items-center gap-1 px-3 py-1.5 rounded-lg ${
                hasFilters ? "bg-indigo-100" : "bg-gray-100"
              }`}
            >
              <Ionicons
                name="options-outline"
                size={14}
                color={hasFilters ? "#6366f1" : "#6b7280"}
              />
              <Text
                className={`text-xs font-medium ${
                  hasFilters ? "text-indigo-700" : "text-gray-600"
                }`}
              >
                필터{hasFilters ? " ●" : ""}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tab selector */}
        <View className="flex-row gap-2">
          {(
            [
              ["popular", "인기 대출"],
              ["hot", "급상승"],
            ] as const
          ).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              onPress={() => setTab(key)}
              className={`flex-1 py-2 rounded-xl items-center ${
                tab === key ? "bg-indigo-600" : "bg-gray-100"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  tab === key ? "text-white" : "text-gray-600"
                }`}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : books.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="bar-chart-outline" size={52} color="#d1d5db" />
          <Text className="text-gray-400 mt-3 text-sm">
            데이터를 불러올 수 없습니다
          </Text>
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item, i) => `${item.isbn13 ?? i}-${i}`}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          renderItem={({ item, index }) => (
            <BookCard book={item} onPress={setSelectedBook} rank={index + 1} />
          )}
        />
      )}

      <FilterModal
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        period={period}
        setPeriod={setPeriod}
        gender={gender}
        setGender={setGender}
        ageFrom={ageFrom}
        setAgeFrom={setAgeFrom}
        ageTo={ageTo}
        setAgeTo={setAgeTo}
        region={region}
        setRegion={setRegion}
      />

      <BookDetailSheet
        book={selectedBook}
        onClose={() => setSelectedBook(null)}
      />
    </SafeAreaView>
  );
}
