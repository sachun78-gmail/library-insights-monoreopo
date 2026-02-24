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
import { AppBackground } from "../../components/AppBackground";
import { isKorean } from "../../lib/i18n";
import type { Book } from "../../lib/types";

type TabType = "popular" | "hot";

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getDateRange(days: number): { startDt: string; endDt: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return { startDt: formatDate(start), endDt: formatDate(end) };
}

const PERIOD_OPTIONS = [
  { label: "7 days", labelKo: "7일", value: "7" },
  { label: "14 days", labelKo: "14일", value: "14" },
  { label: "30 days", labelKo: "30일", value: "30" },
  { label: "90 days", labelKo: "90일", value: "90" },
];

const GENDER_OPTIONS = [
  { label: "All", labelKo: "전체", value: "" },
  { label: "Male", labelKo: "남성", value: "1" },
  { label: "Female", labelKo: "여성", value: "2" },
];

const AGE_OPTIONS = [
  { label: "All", labelKo: "전체", from: "", to: "" },
  { label: "10s", labelKo: "10대", from: "10", to: "19" },
  { label: "20s", labelKo: "20대", from: "20", to: "29" },
  { label: "30s", labelKo: "30대", from: "30", to: "39" },
  { label: "40s", labelKo: "40대", from: "40", to: "49" },
  { label: "50+", labelKo: "50대+", from: "50", to: "59" },
];

const REGION_OPTIONS = [
  { code: "", name: "All", nameKo: "전국" },
  { code: "11", name: "Seoul", nameKo: "서울" },
  { code: "21", name: "Busan", nameKo: "부산" },
  { code: "22", name: "Daegu", nameKo: "대구" },
  { code: "23", name: "Incheon", nameKo: "인천" },
  { code: "24", name: "Gwangju", nameKo: "광주" },
  { code: "25", name: "Daejeon", nameKo: "대전" },
  { code: "26", name: "Ulsan", nameKo: "울산" },
  { code: "29", name: "Sejong", nameKo: "세종" },
  { code: "31", name: "Gyeonggi", nameKo: "경기" },
  { code: "32", name: "Gangwon", nameKo: "강원" },
  { code: "33", name: "Chungbuk", nameKo: "충북" },
  { code: "34", name: "Chungnam", nameKo: "충남" },
  { code: "35", name: "Jeonbuk", nameKo: "전북" },
  { code: "36", name: "Jeonnam", nameKo: "전남" },
  { code: "37", name: "Gyeongbuk", nameKo: "경북" },
  { code: "38", name: "Gyeongnam", nameKo: "경남" },
  { code: "39", name: "Jeju", nameKo: "제주" },
];

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

function FilterModal(props: FilterModalProps) {
  const {
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
  } = props;
  const [draftPeriod, setDraftPeriod] = useState(period);
  const [draftGender, setDraftGender] = useState(gender);
  const [draftAgeFrom, setDraftAgeFrom] = useState(ageFrom);
  const [draftAgeTo, setDraftAgeTo] = useState(ageTo);
  const [draftRegion, setDraftRegion] = useState(region);

  React.useEffect(() => {
    if (visible) {
      setDraftPeriod(period);
      setDraftGender(gender);
      setDraftAgeFrom(ageFrom);
      setDraftAgeTo(ageTo);
      setDraftRegion(region);
    }
  }, [visible, period, gender, ageFrom, ageTo, region]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
        <View className="bg-white rounded-t-3xl px-5 pt-4" style={{ maxHeight: "80%", paddingBottom: 32 }}>
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-gray-900">{isKorean ? "필터" : "Filters"}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text className="text-sm font-semibold text-gray-700 mb-2">{isKorean ? "기간" : "Period"}</Text>
            <View className="flex-row gap-2 mb-4">
              {PERIOD_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setDraftPeriod(opt.value)}
                  className={`px-3 py-2 rounded-lg ${draftPeriod === opt.value ? "bg-indigo-600" : "bg-gray-100"}`}
                >
                  <Text className={`text-xs font-medium ${draftPeriod === opt.value ? "text-white" : "text-gray-600"}`}>
                    {isKorean ? opt.labelKo : opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-sm font-semibold text-gray-700 mb-2">{isKorean ? "성별" : "Gender"}</Text>
            <View className="flex-row gap-2 mb-4">
              {GENDER_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setDraftGender(opt.value)}
                  className={`px-4 py-2 rounded-lg ${draftGender === opt.value ? "bg-indigo-600" : "bg-gray-100"}`}
                >
                  <Text className={`text-xs font-medium ${draftGender === opt.value ? "text-white" : "text-gray-600"}`}>
                    {isKorean ? opt.labelKo : opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-sm font-semibold text-gray-700 mb-2">{isKorean ? "연령" : "Age"}</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {AGE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={`${opt.from}-${opt.to}`}
                  onPress={() => {
                    setDraftAgeFrom(opt.from);
                    setDraftAgeTo(opt.to);
                  }}
                  className={`px-3 py-2 rounded-lg ${
                    draftAgeFrom === opt.from && draftAgeTo === opt.to ? "bg-indigo-600" : "bg-gray-100"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      draftAgeFrom === opt.from && draftAgeTo === opt.to ? "text-white" : "text-gray-600"
                    }`}
                  >
                    {isKorean ? opt.labelKo : opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-sm font-semibold text-gray-700 mb-2">{isKorean ? "지역" : "Region"}</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {REGION_OPTIONS.map((r) => (
                <TouchableOpacity
                  key={r.code}
                  onPress={() => setDraftRegion(r.code)}
                  className={`px-3 py-2 rounded-lg ${draftRegion === r.code ? "bg-indigo-600" : "bg-gray-100"}`}
                >
                  <Text className={`text-xs font-medium ${draftRegion === r.code ? "text-white" : "text-gray-600"}`}>
                    {isKorean ? r.nameKo : r.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View className="flex-row gap-2 mt-2 mb-2">
              <TouchableOpacity
                onPress={() => {
                  setDraftPeriod("30");
                  setDraftGender("");
                  setDraftAgeFrom("");
                  setDraftAgeTo("");
                  setDraftRegion("");
                }}
                className="flex-1 bg-gray-100 rounded-2xl py-3 items-center"
              >
                <Text className="text-gray-700 font-semibold">{isKorean ? "초기화" : "Reset"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setPeriod(draftPeriod);
                  setGender(draftGender);
                  setAgeFrom(draftAgeFrom);
                  setAgeTo(draftAgeTo);
                  setRegion(draftRegion);
                  onClose();
                }}
                className="flex-1 bg-indigo-600 rounded-2xl py-3 items-center"
              >
                <Text className="text-white font-semibold">{isKorean ? "적용하기" : "Apply"}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

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

  const { data: popularBooks, isLoading: isLoadingPopular } = useBestsellers({
    startDt,
    endDt,
    gender: gender || undefined,
    from_age: ageFrom || undefined,
    to_age: ageTo || undefined,
    region: region || undefined,
  });

  const { data: hotBooks = [], isLoading: isLoadingHot } = useHotTrend();

  const books: Book[] = tab === "popular" ? (popularBooks ?? []) : hotBooks;
  const isLoading = tab === "popular" ? isLoadingPopular : isLoadingHot;
  const hasFilters = !!(region || gender || ageFrom || ageTo || period !== "30");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#071426" }}>
      <AppBackground>
        <View
          className="px-5 pt-5 pb-3 border-b"
          style={{ backgroundColor: "rgba(8,20,38,0.78)", borderBottomColor: "#1E293B" }}
        >
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-xl font-bold text-slate-100">{isKorean ? "인기도서" : "Bestsellers"}</Text>
            {tab === "popular" && (
              <TouchableOpacity
                onPress={() => setFilterVisible(true)}
                className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg"
                style={{
                  backgroundColor: hasFilters ? "rgba(99,102,241,0.2)" : "rgba(30,41,59,0.9)",
                  borderWidth: 1,
                  borderColor: hasFilters ? "rgba(129,140,248,0.45)" : "#334155",
                }}
              >
                <Ionicons name="options-outline" size={14} color={hasFilters ? "#A5B4FC" : "#94A3B8"} />
                <Text className="text-xs font-medium" style={{ color: hasFilters ? "#C7D2FE" : "#CBD5E1" }}>
                  {isKorean ? (hasFilters ? "필터 적용됨" : "필터") : hasFilters ? "Filters On" : "Filters"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View className="flex-row gap-2">
            {([
              ["popular", isKorean ? "인기 대출" : "Popular"],
              ["hot", isKorean ? "급상승" : "Hot"],
            ] as const).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                onPress={() => setTab(key)}
                className="flex-1 py-2 rounded-xl items-center"
                style={{
                  backgroundColor: tab === key ? "#4F46E5" : "rgba(30,41,59,0.9)",
                  borderWidth: tab === key ? 0 : 1,
                  borderColor: tab === key ? "transparent" : "#334155",
                }}
              >
                <Text className={`text-sm font-medium ${tab === key ? "text-white" : "text-slate-300"}`}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#6366f1" />
          </View>
        ) : books.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="bar-chart-outline" size={52} color="#475569" />
            <Text className="text-slate-400 mt-3 text-sm text-center">
              {isKorean ? "데이터를 불러오지 못했거나 결과가 없습니다." : "No data available."}
            </Text>
          </View>
        ) : (
          <FlatList
            data={books}
            keyExtractor={(item, i) => `${item.isbn13 ?? i}-${i}`}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            renderItem={({ item, index }) => <BookCard book={item} onPress={setSelectedBook} rank={index + 1} />}
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

        <BookDetailSheet book={selectedBook} onClose={() => setSelectedBook(null)} />
      </AppBackground>
    </SafeAreaView>
  );
}
