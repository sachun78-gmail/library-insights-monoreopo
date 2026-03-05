import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { useAuth } from "../lib/auth-context";
import { api } from "../lib/api";
import { regions as REGIONS_DATA } from "../lib/regions-data.js";
import type { Book, Library, Bookmark, BookReview, FavoriteLibrary } from "../lib/types";

interface Props {
  book: Book | null;
  onClose: () => void;
}

function BookCover({ uri }: { uri: string }) {
  const [failed, setFailed] = React.useState(false);

  if (!uri || failed) {
    return (
      <View style={[styles.bookImage, { backgroundColor: "#1E293B", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#334155" }]}>
        <Ionicons name="book-outline" size={32} color="#475569" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={styles.bookImage}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

const ALL_REGIONS = [
  { code: "11", name: "서울" }, { code: "21", name: "부산" },
  { code: "22", name: "대구" }, { code: "23", name: "인천" },
  { code: "24", name: "광주" }, { code: "25", name: "대전" },
  { code: "26", name: "울산" }, { code: "29", name: "세종" },
  { code: "31", name: "경기" }, { code: "32", name: "강원" },
  { code: "33", name: "충북" }, { code: "34", name: "충남" },
  { code: "35", name: "전북" }, { code: "36", name: "전남" },
  { code: "37", name: "경북" }, { code: "38", name: "경남" },
  { code: "39", name: "제주" },
];

const REGION_NAME_TO_CODE: Record<string, string> = {
  // 한글 단축명
  서울: "11", 부산: "21", 대구: "22", 인천: "23",
  광주: "24", 대전: "25", 울산: "26", 세종: "29",
  경기: "31", 강원: "32",
  충북: "33", 충청북: "33",
  충남: "34", 충청남: "34",
  전북: "35", 전라북: "35",
  전남: "36", 전라남: "36",
  경북: "37", 경상북: "37",
  경남: "38", 경상남: "38",
  제주: "39",
  // 한글 공식 명칭 (reverseGeocode 가 이 값을 그대로 반환할 수 있음)
  서울특별시: "11", 부산광역시: "21", 대구광역시: "22", 인천광역시: "23",
  광주광역시: "24", 대전광역시: "25", 울산광역시: "26", 세종특별자치시: "29",
  경기도: "31",
  강원도: "32", 강원특별자치도: "32",
  충청북도: "33",
  충청남도: "34",
  전라북도: "35", 전북특별자치도: "35",
  전라남도: "36",
  경상북도: "37",
  경상남도: "38",
  제주특별자치도: "39",
  // 영문 (iOS 영문 환경)
  Seoul: "11", Busan: "21", Daegu: "22", Incheon: "23",
  Gwangju: "24", Daejeon: "25", Ulsan: "26", Sejong: "29",
  Gyeonggi: "31", "Gyeonggi-do": "31",
  Gangwon: "32", "Gangwon-do": "32",
  "North Chungcheong": "33", "Chungcheongbuk-do": "33",
  "South Chungcheong": "34", "Chungcheongnam-do": "34",
  "North Jeolla": "35", "Jeollabuk-do": "35",
  "South Jeolla": "36", "Jeollanam-do": "36",
  "North Gyeongsang": "37", "Gyeongsangbuk-do": "37",
  "South Gyeongsang": "38", "Gyeongsangnam-do": "38",
  Jeju: "39", "Jeju-do": "39",
};

type LibraryWithDist = Library & { distance?: number };

/** Haversine 거리(km) */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 주소에서 두 번째 토큰(구/시/군) 추출 */
/** 한국 좌표 범위 체크 */
function isInKorea(lat: number, lon: number): boolean {
  return lat >= 33 && lat <= 39 && lon >= 124 && lon <= 132;
}

/** GPS 역지오코딩 결과 → 지역 코드 */
function mapGeoToRegionCode(geo: Location.LocationGeocodedAddress): string | null {
  // region, city, subregion 순으로 후보를 시도
  const candidates = [geo.region, geo.city, geo.subregion].filter(Boolean) as string[];
  for (const c of candidates) {
    // 1) 원문 그대로 매핑 시도
    if (REGION_NAME_TO_CODE[c]) return REGION_NAME_TO_CODE[c];
    // 2) 행정구역 접미사 제거 후 시도
    const stripped = c
      .replace(/특별자치시$|특별자치도$|특별시$|광역시$|도$|시$/, "")
      .trim();
    if (stripped && REGION_NAME_TO_CODE[stripped]) return REGION_NAME_TO_CODE[stripped];
  }
  return null;
}

function formatPostDate(raw?: string): string {
  if (!raw || raw.length < 8) return "";
  return `${raw.slice(0, 4)}.${raw.slice(4, 6)}.${raw.slice(6, 8)}`;
}

/** HTML 태그 제거 및 엔티티 디코딩
 *  엔티티를 먼저 실제 문자로 변환한 뒤 태그를 제거해야
 *  &lt;b&gt;text&lt;/b&gt; 형태의 API 응답도 깨끗하게 처리됨 */
function stripHtml(html: string): string {
  return html
    // 1) 엔티티 → 실제 문자 변환
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    // 2) 변환 후 드러난 태그 포함 전체 태그 제거
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── PickerModal: 드롭다운 선택 모달 ──────────────────────────
interface PickerModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}

function PickerModal({ visible, onClose, title, options, value, onChange }: PickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={pickerStyles.overlay}>
          <TouchableWithoutFeedback>
            <View style={pickerStyles.sheet}>
              <View style={pickerStyles.header}>
                <Text style={pickerStyles.title}>{title}</Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={pickerStyles.list}>
                {options.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[pickerStyles.option, opt.value === value && pickerStyles.optionSelected]}
                    onPress={() => { onChange(opt.value); onClose(); }}
                  >
                    <Text
                      style={[
                        pickerStyles.optionText,
                        opt.value === value && pickerStyles.optionTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {opt.value === value && (
                      <Ionicons name="checkmark" size={17} color="#4F46E5" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#1E293B",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "75%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  title: { fontSize: 15, fontWeight: "700", color: "#F1F5F9" },
  list: { paddingBottom: 24 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#293548",
  },
  optionSelected: { backgroundColor: "#1E1B4B" },
  optionText: { fontSize: 14, color: "#CBD5E1" },
  optionTextSelected: { color: "#818CF8", fontWeight: "600" },
});

// ── LibraryItem ───────────────────────────────────────────────
function LibraryItem({ lib, isbn, isFavorite, onToggleFavorite }: {
  lib: LibraryWithDist;
  isbn: string;
  isFavorite: boolean;
  onToggleFavorite?: (lib: LibraryWithDist) => void;
}) {
  const { data, isLoading } = useQuery<{ hasBook: boolean; loanAvailable: boolean }>({
    queryKey: ["book-exist", isbn, lib.libCode],
    queryFn: () => api.bookExist(isbn, lib.libCode),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const distKm = lib.distance != null
    ? (lib.distance < 10 ? lib.distance.toFixed(1) : Math.round(lib.distance).toString())
    : null;

  return (
    <View style={libStyles.card}>
      {/* 1행: 도서관명 + 즐겨찾기 + 홈페이지 버튼 */}
      <View style={libStyles.nameRow}>
        <Text style={libStyles.name} numberOfLines={1}>
          {lib.libName}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {onToggleFavorite && (
            <TouchableOpacity
              onPress={() => onToggleFavorite(lib)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isFavorite ? "star" : "star-outline"}
                size={20}
                color={isFavorite ? "#F59E0B" : "#6B7280"}
              />
            </TouchableOpacity>
          )}
          {lib.homepage ? (
            <TouchableOpacity
              style={libStyles.homeBtn}
              onPress={() => lib.homepage && Linking.openURL(lib.homepage)}
            >
              <Text style={libStyles.homeBtnText}>홈페이지</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* 2행: 즐겨찾기 뱃지 + 거리 + 대출 상태 */}
      <View style={libStyles.badgeRow}>
        {isFavorite && (
          <View style={libStyles.favBadge}>
            <Ionicons name="star" size={11} color="#D97706" />
            <Text style={libStyles.favText}>내 도서관</Text>
          </View>
        )}
        {distKm !== null && (
          <View style={libStyles.distBadge}>
            <Ionicons name="navigate" size={11} color="#4F46E5" />
            <Text style={libStyles.distText}>{distKm}km</Text>
          </View>
        )}
        {isLoading ? (
          <ActivityIndicator size="small" color="#6366F1" />
        ) : data ? (
          <View
            style={[
              libStyles.loanBadge,
              data.loanAvailable ? libStyles.loanAvail : libStyles.loanUnavail,
            ]}
          >
            <Ionicons
              name={data.loanAvailable ? "checkmark-circle-outline" : "close-circle-outline"}
              size={11}
              color={data.loanAvailable ? "#065F46" : "#991B1B"}
            />
            <Text
              style={[
                libStyles.loanText,
                data.loanAvailable ? libStyles.loanTextAvail : libStyles.loanTextUnavail,
              ]}
            >
              {data.loanAvailable ? "대출가능" : "대출중"}
            </Text>
          </View>
        ) : null}
      </View>

      {/* 3행: 주소 */}
      <View style={libStyles.infoRow}>
        <Ionicons name="location-outline" size={12} color="#9CA3AF" />
        <Text style={libStyles.infoText} numberOfLines={1}>{lib.address}</Text>
      </View>
      {/* 4행: 전화 */}
      {lib.tel ? (
        <View style={libStyles.infoRow}>
          <Ionicons name="call-outline" size={12} color="#9CA3AF" />
          <Text style={libStyles.infoText}>{lib.tel}</Text>
        </View>
      ) : null}
    </View>
  );
}

const libStyles = StyleSheet.create({
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    padding: 12,
    marginBottom: 8,
  },
  // 1행: 도서관명 + 홈페이지
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },
  name: { flex: 1, fontSize: 13, fontWeight: "700", color: "#F1F5F9" },
  homeBtn: {
    backgroundColor: "#B45309",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 0,
  },
  homeBtnText: { fontSize: 11, fontWeight: "700", color: "#FEF3C7" },
  // 2행: 거리 + 대출 배지
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  distBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#1E1B4B",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  distText: { fontSize: 12, fontWeight: "700", color: "#818CF8" },
  loanBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  loanAvail: { backgroundColor: "rgba(16,185,129,0.2)" },
  loanUnavail: { backgroundColor: "rgba(239,68,68,0.2)" },
  loanText: { fontSize: 12, fontWeight: "600" },
  loanTextAvail: { color: "#34D399" },
  loanTextUnavail: { color: "#F87171" },
  // 즐겨찾기 뱃지
  favBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(245,158,11,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  favText: { fontSize: 12, fontWeight: "600", color: "#FBBF24" },
  // 3-4행: 주소/전화
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: 2 },
  infoText: { fontSize: 11, color: "#64748B", flex: 1 },
});

// ── Main Component ────────────────────────────────────────────
export function BookDetailSheet({ book, onClose }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);

  const [showLibrary, setShowLibrary] = useState(false);
  const [showAI, setShowAI] = useState(false);

  // 한줄평
  const [myRating, setMyRating] = useState(0);
  const [myReviewText, setMyReviewText] = useState("");
  const [reviewsExpanded, setReviewsExpanded] = useState(false);

  // GPS – ref로 중복 fetch 완전 차단
  const gpsFetchedRef = useRef(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "ok" | "denied">("idle");
  const [gpsRegionCode, setGpsRegionCode] = useState<string | null>(null);

  // 즐겨찾기 도서관
  const { data: favoriteLibs = [] } = useQuery<FavoriteLibrary[]>({
    queryKey: ["favorite-libraries"],
    queryFn: () => api.favoriteLibraries(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
  const favLibCodes = useMemo(() => new Set(favoriteLibs.map(f => f.lib_code)), [favoriteLibs]);

  const addFavMutation = useMutation({
    mutationFn: (lib: LibraryWithDist) => api.addFavoriteLibrary({
      lib_code: lib.libCode,
      lib_name: lib.libName,
      address: lib.address,
      tel: lib.tel,
      latitude: lib.latitude,
      longitude: lib.longitude,
      homepage: lib.homepage,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorite-libraries"] }),
    onError: (err: Error) => Alert.alert("오류", err.message),
  });

  const removeFavMutation = useMutation({
    mutationFn: (libCode: string) => api.removeFavoriteLibrary(libCode),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorite-libraries"] }),
  });

  const handleToggleFavorite = (lib: LibraryWithDist) => {
    if (!user) return;
    if (favLibCodes.has(lib.libCode)) {
      removeFavMutation.mutate(lib.libCode);
    } else {
      addFavMutation.mutate(lib);
    }
  };

  // 지역 선택
  const [selectedRegion, setSelectedRegion] = useState("11");
  const [selectedSubRegion, setSelectedSubRegion] = useState("");
  const [regionPickerVisible, setRegionPickerVisible] = useState(false);
  const [subRegionPickerVisible, setSubRegionPickerVisible] = useState(false);

  // 도서 변경 시 섹션 상태 초기화
  useEffect(() => {
    setShowLibrary(false);
    setShowAI(false);
    setSelectedSubRegion("");
    setMyRating(0);
    setMyReviewText("");
    setReviewsExpanded(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [book?.isbn13]);

  // 도서관 섹션 열릴 때 GPS 취득 – showLibrary 변경 시만 감시, ref로 중복 방지
  useEffect(() => {
    if (showLibrary && !gpsFetchedRef.current) {
      gpsFetchedRef.current = true;
      fetchUserLocation();
    }
  }, [showLibrary]);

  // 도서관 섹션 열리면 스크롤 아래로
  useEffect(() => {
    if (showLibrary) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    }
  }, [showLibrary, selectedRegion]);

  async function fetchUserLocation() {
    setLocationStatus("loading");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationStatus("denied");
        return;
      }

      let coords: { latitude: number; longitude: number } | null = null;

      // 1) 최근 5분 이내 캐시 위치 시도 – 한국 범위인 경우에만 사용
      try {
        const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
        if (last && isInKorea(last.coords.latitude, last.coords.longitude)) {
          coords = last.coords;
        }
      } catch { /* ignore */ }

      // 2) 캐시가 없거나 한국 범위 밖이면 현재 위치 새로 취득
      if (!coords) {
        try {
          const cur = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
          });
          if (isInKorea(cur.coords.latitude, cur.coords.longitude)) {
            coords = cur.coords;
          }
        } catch { /* ignore */ }
      }

      // 3) 유효한 한국 내 좌표를 얻지 못한 경우 → GPS 사용 불가로 처리
      if (!coords) {
        setLocationStatus("denied");
        return;
      }

      const { latitude: lat, longitude: lon } = coords;
      setUserLocation({ lat, lon });

      // 역지오코딩으로 지역 코드 감지
      try {
        const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
        if (results && results.length > 0) {
          const code = mapGeoToRegionCode(results[0]);
          if (code) {
            setSelectedRegion(code);
            setGpsRegionCode(code);
          }
        }
      } catch {
        // 역지오코딩 실패해도 GPS 좌표는 유지
      }
      setLocationStatus("ok");
    } catch {
      setLocationStatus("denied");
    }
  }

  // ── 북마크 ──
  const { data: bookmarks } = useQuery<Bookmark[]>({
    queryKey: ["bookmarks", user?.id],
    queryFn: () => api.bookmarks(),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const isBookmarked = bookmarks?.some((b) => b.isbn13 === book?.isbn13) ?? false;

  const addMutation = useMutation({
    mutationFn: () => api.addBookmark(book!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookmarks", user?.id] }),
  });
  const removeMutation = useMutation({
    mutationFn: () => api.removeBookmark(book!.isbn13),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookmarks", user?.id] }),
  });

  const handleBookmark = () => {
    if (!user) {
      Alert.alert("로그인 필요", "찜하기 기능은 로그인 후 이용 가능합니다.", [
        { text: "취소", style: "cancel" },
        { text: "로그인", onPress: () => { onClose(); router.push("/login"); } },
      ]);
      return;
    }
    if (isBookmarked) removeMutation.mutate();
    else addMutation.mutate();
  };

  // ── 도서관 정보나루 책소개 (항상 fetch) ──
  const { data: introData, isLoading: isIntroLoading } = useQuery<any>({
    queryKey: ["book-intro", book?.isbn13],
    queryFn: () => api.bookIntro(book!.isbn13),
    enabled: !!book,
    staleTime: 7 * 24 * 60 * 60 * 1000,
    retry: false,
  });
  const introDescription = introData?.description ? stripHtml(introData.description) : "";

  // ── 네이버 블로그 리뷰 ──
  const { data: reviewData, isLoading: isReviewLoading } = useQuery<any>({
    queryKey: ["book-review", book?.isbn13],
    queryFn: () => api.bookDetail(book!.isbn13, book?.bookname),
    enabled: !!book,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });

  const naverReview = reviewData?.review;
  const naverSearchUrl = book
    ? `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(
        (book.bookname ?? "") + " 책 리뷰"
      )}`
    : undefined;

  // ── AI 인사이트 ──
  const { data: insight, isLoading: isInsightLoading } = useQuery<any>({
    queryKey: ["ai-insight", book?.bookname],
    queryFn: () => api.bookAIInsight(book!.bookname, book?.authors),
    enabled: !!book && !!user && showAI,
    staleTime: 7 * 24 * 60 * 60 * 1000,
    retry: false,
  });

  // ── 도서관 검색 ──
  // GPS 완료(ok/denied) 이후에만 쿼리 실행.
  // GPS가 성공하면 selectedRegion이 실제 위치 기반 코드로 업데이트되고 자동 재조회.
  const libQueryEnabled =
    !!book && showLibrary && (locationStatus === "ok" || locationStatus === "denied");

  const { data: rawLibraries = [], isLoading: isLibLoading } = useQuery<Library[]>({
    queryKey: ["libraries", book?.isbn13, selectedRegion, selectedSubRegion],
    queryFn: () => api.libraryByBook(book!.isbn13, selectedRegion, selectedSubRegion || undefined),
    enabled: libQueryEnabled,
    staleTime: 10 * 60 * 1000,
  });

  // 거리 계산: rawLibraries + userLocation → LibraryWithDist[]
  const librariesWithDist = useMemo<LibraryWithDist[]>(() => {
    if (!userLocation) {
      // GPS 없으면 distance 없이 그대로 반환
      return rawLibraries as LibraryWithDist[];
    }
    return rawLibraries.map((lib) => {
      const lat = parseFloat(lib.latitude);
      const lon = parseFloat(lib.longitude);
      // 한국 범위 벗어나는 좌표(0,0 등) 무시
      if (isNaN(lat) || isNaN(lon) || lat < 33 || lat > 39 || lon < 124 || lon > 132) {
        return lib as LibraryWithDist;
      }
      const distance = haversineKm(userLocation.lat, userLocation.lon, lat, lon);
      return { ...lib, distance } as LibraryWithDist;
    });
  }, [rawLibraries, userLocation]);

  // 세부지역 목록 (선택된 광역 지역의 정적 목록 사용)
  const subRegions = useMemo(() => {
    const region = REGIONS_DATA.find((r: any) => r.code === selectedRegion);
    return region?.subRegions ?? [];
  }, [selectedRegion]);

  // 유효한 한국 내 GPS 좌표를 얻은 경우 3km 필터 적용 (지역 코드 일치 불필요)
  const isGpsRegion = locationStatus === "ok" && userLocation !== null;

  // 표시할 라이브러리 목록: 즐겨찾기 주입 → 거리순 정렬 → 3km 필터(GPS 지역만)
  // 세부지역 필터링은 API(dtl_region)에서 처리
  const displayedLibraries = useMemo<LibraryWithDist[]>(() => {
    let libs = [...librariesWithDist];

    // 검색 결과에 없는 즐겨찾기 도서관을 주입
    const seenCodes = new Set(libs.map(l => l.libCode));
    for (const fav of favoriteLibs) {
      if (!seenCodes.has(fav.lib_code)) {
        libs.push({
          libCode: fav.lib_code,
          libName: fav.lib_name,
          address: fav.address,
          tel: fav.tel,
          latitude: fav.latitude,
          longitude: fav.longitude,
          homepage: fav.homepage,
        } as LibraryWithDist);
      }
    }

    // 즐겨찾기 도서관 우선 → 거리순
    libs.sort((a, b) => {
      const aFav = favLibCodes.has(a.libCode) ? 0 : 1;
      const bFav = favLibCodes.has(b.libCode) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      const da = a.distance ?? Infinity;
      const db = b.distance ?? Infinity;
      return da - db;
    });

    // GPS 감지 지역일 때 3km 이내만 표시 (즐겨찾기는 항상 표시)
    if (isGpsRegion) {
      libs = libs.filter((l) => favLibCodes.has(l.libCode) || (l.distance !== undefined && l.distance <= 3));
    }

    return libs;
  }, [librariesWithDist, isGpsRegion, favLibCodes, favoriteLibs]);

  const within3kmCount = useMemo(() => {
    return librariesWithDist.filter(
      (l) => l.distance !== undefined && l.distance <= 3
    ).length;
  }, [librariesWithDist]);

  const regionName = ALL_REGIONS.find((r) => r.code === selectedRegion)?.name ?? selectedRegion;
  const isMutating = addMutation.isPending || removeMutation.isPending;

  // ── 한줄평 ──
  const { data: reviews = [], isLoading: isReviewsLoading } = useQuery<BookReview[]>({
    queryKey: ["book-reviews", book?.isbn13],
    queryFn: () => api.bookReviews(book!.isbn13),
    enabled: !!book?.isbn13,
    staleTime: 60 * 1000,
  });

  // 내 리뷰 찾기 & 폼 초기화
  useEffect(() => {
    if (!user || reviews.length === 0) return;
    const mine = reviews.find((r) => r.user_id === user.id);
    if (mine) {
      setMyRating(mine.rating);
      setMyReviewText(mine.review_text);
    }
  }, [reviews, user]);

  const myExistingReview = user ? reviews.find((r) => r.user_id === user.id) : undefined;

  const upsertMutation = useMutation({
    mutationFn: () =>
      api.upsertReview({
        isbn13: book!.isbn13,
        bookname: book!.bookname,
        authors: book!.authors,
        publisher: book!.publisher,
        book_image_url: book!.bookImageURL,
        display_name: (user as any)?.user_metadata?.name ?? (user as any)?.email?.split("@")[0] ?? "",
        rating: myRating,
        review_text: myReviewText.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["book-reviews", book?.isbn13] });
      queryClient.invalidateQueries({ queryKey: ["all-reviews"] });
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: () => api.deleteReview(book!.isbn13),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["book-reviews", book?.isbn13] });
      queryClient.invalidateQueries({ queryKey: ["all-reviews"] });
      setMyRating(0);
      setMyReviewText("");
    },
  });

  const handleSubmitReview = () => {
    if (!user) {
      Alert.alert("로그인 필요", "한줄평은 로그인 후 이용 가능합니다.", [
        { text: "취소", style: "cancel" },
        { text: "로그인", onPress: () => { onClose(); router.push("/login"); } },
      ]);
      return;
    }
    if (myRating === 0) {
      Alert.alert("별점 선택", "별점을 선택해주세요.");
      return;
    }
    if (myReviewText.trim().length === 0) {
      Alert.alert("내용 입력", "한줄평을 입력해주세요.");
      return;
    }
    upsertMutation.mutate();
  };

  const handleDeleteReview = () => {
    Alert.alert("삭제 확인", "한줄평을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: () => deleteReviewMutation.mutate() },
    ]);
  };

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const REVIEWS_PREVIEW = 3;
  const displayedReviews = reviewsExpanded ? reviews : reviews.slice(0, REVIEWS_PREVIEW);

  const subRegionOptions = useMemo(
    () => [
      { label: "전체", value: "" },
      ...subRegions.map((s: any) => ({ label: s.name, value: s.code })),
    ],
    [subRegions]
  );

  return (
    <Modal visible={!!book} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} />
      </TouchableWithoutFeedback>

      <View style={styles.sheet}>
        <View style={styles.handle} />

        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} bounces={false}>
          {book && (
            <>
              {/* ── 도서 헤더 ── */}
              <View style={styles.bookHeader}>
                <BookCover uri={book.bookImageURL} />
                <View style={styles.bookInfo}>
                  <Text style={styles.bookTitle} numberOfLines={4}>
                    {book.bookname}
                  </Text>
                  <Text style={styles.bookAuthor}>{book.authors}</Text>
                  <Text style={styles.bookPublisher}>
                    {book.publisher}
                    {book.publication_year ? ` · ${book.publication_year}` : ""}
                  </Text>
                  <View style={styles.badgeRow}>
                    {book.class_nm && (
                      <View style={styles.classBadge}>
                        <Text style={styles.classText}>{book.class_nm}</Text>
                      </View>
                    )}
                    {book.isbn13 && (
                      <View style={styles.isbnBadge}>
                        <Text style={styles.isbnText}>ISBN {book.isbn13}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.bookmarkBtn}
                  onPress={handleBookmark}
                  disabled={isMutating}
                >
                  {isMutating ? (
                    <ActivityIndicator size="small" color="#DC2626" />
                  ) : (
                    <Ionicons
                      name={isBookmarked ? "heart" : "heart-outline"}
                      size={26}
                      color={isBookmarked ? "#DC2626" : "#9CA3AF"}
                    />
                  )}
                </TouchableOpacity>
              </View>

              {/* ── AI 요약 & 핵심 인사이트 ── */}
              <View style={styles.aiSection}>
                <TouchableOpacity
                  style={styles.aiToggle}
                  onPress={() => {
                    if (!user) {
                      Alert.alert(
                        "로그인 필요",
                        "AI 인사이트는 로그인 후 이용 가능합니다.",
                        [
                          { text: "취소", style: "cancel" },
                          { text: "로그인", onPress: () => { onClose(); router.push("/login"); } },
                        ]
                      );
                      return;
                    }
                    setShowAI(!showAI);
                  }}
                >
                  <Text style={styles.aiToggleIcon}>✦</Text>
                  <Text style={styles.aiToggleText}>AI 요약 & 핵심 Insight</Text>
                  {!user && (
                    <View style={styles.loginBadge}>
                      <Text style={styles.loginBadgeText}>로그인 필요</Text>
                    </View>
                  )}
                  <Ionicons
                    name={showAI ? "chevron-up" : "chevron-forward"}
                    size={16}
                    color="#7C3AED"
                    style={{ marginLeft: "auto" }}
                  />
                </TouchableOpacity>

                {showAI && user && (
                  <>
                    {isInsightLoading ? (
                      <View style={styles.loadingRow}>
                        <ActivityIndicator size="small" color="#7C3AED" />
                        <Text style={styles.loadingText}>AI 분석 중...</Text>
                      </View>
                    ) : insight ? (
                      <View style={styles.insightBody}>
                        <Text style={styles.insightSummary}>{insight.summary}</Text>
                        <View style={styles.insightRow}>
                          <View style={styles.insightCard}>
                            <Text style={styles.insightCardLabel}>핵심 메시지</Text>
                            <Text style={styles.insightCardText}>{insight.keyMessage}</Text>
                          </View>
                          <View style={styles.insightCard}>
                            <Text style={styles.insightCardLabel}>추천 대상</Text>
                            <Text style={styles.insightCardText}>{insight.recommendFor}</Text>
                          </View>
                        </View>
                        <View style={[styles.insightCard, { marginTop: 0 }]}>
                          <Text style={styles.insightCardLabel}>난이도</Text>
                          <Text style={styles.insightCardText}>{insight.difficulty}</Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.insightEmpty}>AI 분석 결과를 가져올 수 없습니다.</Text>
                    )}
                  </>
                )}
              </View>

              {/* ── 도서 정보 및 리뷰 ── */}
              <View style={styles.infoSection}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="book-outline" size={15} color="#374151" />
                  <Text style={styles.sectionTitle}>도서 정보 및 리뷰</Text>
                </View>

                {/* 도서관 정보나루 책소개 */}
                <View style={styles.infoCard}>
                  <View style={styles.infoCardHeader}>
                    <Ionicons name="library-outline" size={14} color="#4B5563" />
                    <Text style={styles.infoCardTitle}>도서관 정보나루 책소개</Text>
                  </View>
                  {isIntroLoading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color="#6366F1" />
                      <Text style={styles.loadingText}>책소개 불러오는 중...</Text>
                    </View>
                  ) : introDescription ? (
                    <Text style={styles.introText}>{introDescription}</Text>
                  ) : (
                    <Text style={styles.emptyText}>등록된 책소개가 없습니다.</Text>
                  )}
                </View>

                {/* 블로그 리뷰 */}
                {isReviewLoading ? (
                  <View style={[styles.infoCard, { flexDirection: "row", alignItems: "center", gap: 8 }]}>
                    <ActivityIndicator size="small" color="#6366F1" />
                    <Text style={styles.loadingText}>리뷰 불러오는 중...</Text>
                  </View>
                ) : naverReview ? (
                  <View style={styles.infoCard}>
                    <View style={styles.infoCardHeader}>
                      <Ionicons name="chatbubble-ellipses-outline" size={14} color="#03C75A" />
                      <Text style={[styles.infoCardTitle, { color: "#065F46" }]}>블로그 리뷰</Text>
                    </View>
                    <Text style={styles.blogReviewTitle} numberOfLines={2}>
                      {stripHtml(naverReview.title ?? "")}
                    </Text>
                    <Text style={styles.blogReviewDesc} numberOfLines={3}>
                      {stripHtml(naverReview.description ?? "")}
                    </Text>
                    <View style={styles.blogReviewFooter}>
                      <Text style={styles.blogReviewMeta}>
                        {naverReview.bloggerName}
                        {naverReview.postDate ? "  ·  " + formatPostDate(naverReview.postDate) : ""}
                      </Text>
                      <TouchableOpacity
                        onPress={() => naverReview.link && Linking.openURL(naverReview.link)}
                      >
                        <Text style={styles.blogReviewLink}>전체 보기</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                {/* 네이버 더보기 버튼 */}
                {naverSearchUrl ? (
                  <TouchableOpacity
                    style={styles.naverBtn}
                    onPress={() => Linking.openURL(naverSearchUrl)}
                  >
                    <Text style={styles.naverBtnN}>N</Text>
                    <Text style={styles.naverBtnLabel}>네이버에서 더 많은 리뷰 보기</Text>
                    <Ionicons name="open-outline" size={13} color="#FFFFFF" />
                  </TouchableOpacity>
                ) : null}

              </View>

              {/* ── 독자 한줄평 ── */}
              <View style={[styles.reviewSection, !book.isbn13 && { display: "none" }]}>
                <View style={styles.reviewSectionHeader}>
                  <Text style={styles.reviewSectionIcon}>★</Text>
                  <Text style={styles.reviewSectionTitle}>독자 한줄평</Text>
                  {avgRating !== null && (
                    <View style={styles.avgBadge}>
                      <Text style={styles.avgBadgeText}>★ {avgRating}</Text>
                      <Text style={styles.avgBadgeCount}> ({reviews.length})</Text>
                    </View>
                  )}
                </View>

                {/* 내 한줄평 작성 폼 */}
                {user ? (
                  <View style={styles.myReviewForm}>
                    <Text style={styles.myReviewLabel}>
                      {myExistingReview ? "내 한줄평 수정" : "한줄평 작성"}
                    </Text>
                    {/* 별점 선택 */}
                    <View style={styles.starRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity key={star} onPress={() => setMyRating(star)} hitSlop={8}>
                          <Text style={[styles.starBtn, myRating >= star && styles.starBtnActive]}>
                            ★
                          </Text>
                        </TouchableOpacity>
                      ))}
                      {myRating > 0 && (
                        <Text style={styles.ratingLabel}>{myRating}점</Text>
                      )}
                    </View>
                    <TextInput
                      style={styles.reviewInput}
                      placeholder="한줄평을 입력하세요 (최대 100자)"
                      placeholderTextColor="#475569"
                      value={myReviewText}
                      onChangeText={(t) => setMyReviewText(t.slice(0, 100))}
                      multiline
                      maxLength={100}
                    />
                    <Text style={styles.charCount}>{myReviewText.length}/100</Text>
                    <View style={styles.reviewBtnRow}>
                      <TouchableOpacity
                        style={styles.reviewSubmitBtn}
                        onPress={handleSubmitReview}
                        disabled={upsertMutation.isPending}
                      >
                        {upsertMutation.isPending ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.reviewSubmitBtnText}>
                            {myExistingReview ? "수정" : "등록"}
                          </Text>
                        )}
                      </TouchableOpacity>
                      {myExistingReview && (
                        <TouchableOpacity
                          style={styles.reviewDeleteBtn}
                          onPress={handleDeleteReview}
                          disabled={deleteReviewMutation.isPending}
                        >
                          <Text style={styles.reviewDeleteBtnText}>삭제</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.loginPrompt}
                    onPress={() => { onClose(); router.push("/login"); }}
                  >
                    <Ionicons name="person-circle-outline" size={16} color="#64748B" />
                    <Text style={styles.loginPromptText}>로그인 후 한줄평을 남겨보세요</Text>
                  </TouchableOpacity>
                )}

                {/* 리뷰 목록 */}
                {isReviewsLoading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#6366F1" />
                    <Text style={styles.loadingText}>한줄평 불러오는 중...</Text>
                  </View>
                ) : reviews.length === 0 ? (
                  <Text style={styles.reviewsEmptyText}>아직 한줄평이 없습니다.</Text>
                ) : (
                  <>
                    {displayedReviews.map((r) => (
                      <View key={r.id} style={styles.reviewCard}>
                        <View style={styles.reviewCardHeader}>
                          <Text style={styles.reviewerName}>
                            {r.display_name || `독자_${r.user_id.replace(/-/g, "").slice(0, 8).toUpperCase()}`}
                          </Text>
                          {user && r.user_id === user.id && (
                            <View style={styles.meBadge}>
                              <Text style={styles.meBadgeText}>나</Text>
                            </View>
                          )}
                          <Text style={styles.reviewStars}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</Text>
                        </View>
                        <Text style={styles.reviewText}>{r.review_text}</Text>
                        <Text style={styles.reviewDate}>
                          {new Date(r.created_at).toLocaleDateString("ko-KR")}
                        </Text>
                      </View>
                    ))}
                    {reviews.length > REVIEWS_PREVIEW && !reviewsExpanded && (
                      <TouchableOpacity
                        style={styles.showMoreBtn}
                        onPress={() => setReviewsExpanded(true)}
                      >
                        <Text style={styles.showMoreText}>
                          {reviews.length - REVIEWS_PREVIEW}개 더 보기
                        </Text>
                        <Ionicons name="chevron-down" size={13} color="#818CF8" />
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>

              {/* ── 도서 소장 도서관 ── */}
              <View style={styles.librarySection}>
                <TouchableOpacity
                  style={styles.libraryToggle}
                  onPress={() => setShowLibrary(!showLibrary)}
                >
                  <Text style={styles.librarySectionIcon}>🔖</Text>
                  <Text style={styles.libraryToggleText}>도서 소장 도서관</Text>
                  <Ionicons
                    name={showLibrary ? "chevron-up" : "chevron-down"}
                    size={16}
                    color="#6B7280"
                    style={{ marginLeft: "auto" }}
                  />
                </TouchableOpacity>

                {showLibrary && (
                  <View style={styles.libraryBody}>
                    {/* GPS 안내 문구 */}
                    <View style={styles.gpsSubtitle}>
                      <Ionicons
                        name={locationStatus === "ok" ? "navigate-circle-outline" : "navigate-outline"}
                        size={13}
                        color={locationStatus === "ok" ? "#4F46E5" : "#9CA3AF"}
                      />
                      <Text style={[
                        styles.gpsSubtitleText,
                        locationStatus === "ok" && styles.gpsSubtitleActive,
                      ]}>
                        {locationStatus === "loading"
                          ? "GPS 위치 확인 중..."
                          : locationStatus === "ok"
                          ? "GPS 위치 기반 결과 · 지역을 변경하여 재검색할 수 있습니다."
                          : "지역을 선택하여 검색하세요."}
                      </Text>
                    </View>

                    {/* 지역 / 세부지역 드롭다운 */}
                    <View style={styles.dropdownRow}>
                      <View style={styles.dropdownWrap}>
                        <Text style={styles.dropdownLabel}>지역</Text>
                        <TouchableOpacity
                          style={styles.dropdown}
                          onPress={() => setRegionPickerVisible(true)}
                        >
                          <Text style={styles.dropdownValue}>{regionName}</Text>
                          <Ionicons name="chevron-down" size={12} color="#6B7280" />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.dropdownWrap}>
                        <Text style={styles.dropdownLabel}>세부 지역</Text>
                        <TouchableOpacity
                          style={styles.dropdown}
                          onPress={() => setSubRegionPickerVisible(true)}
                          disabled={subRegionOptions.length <= 1}
                        >
                          <Text style={styles.dropdownValue}>
                            {subRegionOptions.find(o => o.value === selectedSubRegion)?.label || "전체"}
                          </Text>
                          <Ionicons name="chevron-down" size={12} color="#6B7280" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* 도서관 목록 */}
                    {(locationStatus === "idle" || locationStatus === "loading" || isLibLoading) ? (
                      <View style={styles.loadingRow}>
                        <ActivityIndicator size="small" color="#6366F1" />
                        <Text style={styles.loadingText}>
                          {locationStatus === "idle" || locationStatus === "loading"
                            ? "GPS 위치 확인 중..."
                            : "도서관 검색 중..."}
                        </Text>
                      </View>
                    ) : displayedLibraries.length === 0 ? (
                      <Text style={styles.noLibText}>
                        {isGpsRegion
                          ? `반경 3km 이내 소장 도서관이 없습니다.\n다른 지역을 선택해 보세요.`
                          : "해당 지역에서 소장한 도서관이 없습니다."}
                      </Text>
                    ) : (
                      <>
                        {displayedLibraries.slice(0, 15).map((lib) => (
                          <LibraryItem
                            key={lib.libCode}
                            lib={lib}
                            isbn={book.isbn13}
                            isFavorite={favLibCodes.has(lib.libCode)}
                            onToggleFavorite={user ? handleToggleFavorite : undefined}
                          />
                        ))}
                        {displayedLibraries.length > 15 && (
                          <Text style={styles.moreLibText}>
                            외 {displayedLibraries.length - 15}개 도서관
                          </Text>
                        )}
                      </>
                    )}

                    {/* 하단 요약 텍스트 */}
                    {!isLibLoading && displayedLibraries.length > 0 && (
                      <Text style={styles.libSummaryText}>
                        {isGpsRegion
                          ? `반경 3km 이내 ${within3kmCount}개 소장 도서관 (가까운 순)`
                          : `${regionName}${selectedSubRegion ? " " + selectedSubRegion : ""} 내 ${displayedLibraries.length}개 소장 도서관`}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>

        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>닫기</Text>
        </TouchableOpacity>
      </View>

      {/* 지역 선택 피커 */}
      <PickerModal
        visible={regionPickerVisible}
        onClose={() => setRegionPickerVisible(false)}
        title="지역 선택"
        options={ALL_REGIONS.map((r) => ({ label: r.name, value: r.code }))}
        value={selectedRegion}
        onChange={(v) => {
          setSelectedRegion(v);
          setSelectedSubRegion("");
        }}
      />

      {/* 세부지역 선택 피커 */}
      <PickerModal
        visible={subRegionPickerVisible}
        onClose={() => setSubRegionPickerVisible(false)}
        title="세부 지역 선택"
        options={subRegionOptions}
        value={selectedSubRegion}
        onChange={setSelectedSubRegion}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: "#1E293B",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: "#334155",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12, marginBottom: 4,
  },

  // 도서 헤더
  bookHeader: {
    flexDirection: "row", gap: 14,
    paddingHorizontal: 20, paddingVertical: 16,
    alignItems: "flex-start",
    borderBottomWidth: 1, borderBottomColor: "#334155",
  },
  bookImage: { width: 80, height: 110, borderRadius: 8 },
  bookInfo: { flex: 1 },
  bookTitle: { fontSize: 15, fontWeight: "700", color: "#F1F5F9", marginBottom: 4, lineHeight: 22 },
  bookAuthor: { fontSize: 13, color: "#94A3B8", marginBottom: 2 },
  bookPublisher: { fontSize: 12, color: "#64748B", marginBottom: 6 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  classBadge: { backgroundColor: "#334155", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  classText: { fontSize: 10, color: "#94A3B8" },
  isbnBadge: { backgroundColor: "#1E1B4B", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  isbnText: { fontSize: 10, color: "#818CF8" },
  bookmarkBtn: { padding: 4, marginTop: 2 },

  // 공통
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
  loadingText: { fontSize: 12, color: "#64748B" },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#CBD5E1" },

  // AI 인사이트
  aiSection: {
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    backgroundColor: "#1E1B4B",
    borderRadius: 12,
    borderWidth: 1, borderColor: "#312E81",
    overflow: "hidden",
  },
  aiToggle: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14 },
  aiToggleIcon: { fontSize: 15, color: "#A78BFA" },
  aiToggleText: { fontSize: 14, fontWeight: "600", color: "#C4B5FD" },
  loginBadge: {
    backgroundColor: "#5B21B6", borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2, marginLeft: 4,
  },
  loginBadgeText: { fontSize: 10, fontWeight: "700", color: "#FFFFFF" },
  insightBody: { paddingHorizontal: 14, paddingBottom: 14 },
  insightSummary: { fontSize: 13, color: "#CBD5E1", lineHeight: 20, marginBottom: 12 },
  insightRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  insightCard: { flex: 1, backgroundColor: "#0F172A", borderRadius: 10, padding: 10 },
  insightCardLabel: { fontSize: 10, color: "#64748B", marginBottom: 4 },
  insightCardText: { fontSize: 12, color: "#CBD5E1" },
  insightEmpty: { fontSize: 12, color: "#64748B", padding: 14 },

  // 도서 정보 및 리뷰
  infoSection: { marginHorizontal: 16, marginTop: 16, marginBottom: 4 },
  infoCard: {
    backgroundColor: "#0F172A",
    borderRadius: 12,
    borderWidth: 1, borderColor: "#334155",
    padding: 14, marginBottom: 10,
  },
  infoCardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  infoCardTitle: { fontSize: 12, fontWeight: "700", color: "#94A3B8" },
  introText: { fontSize: 13, color: "#CBD5E1", lineHeight: 20 },
  emptyText: { fontSize: 12, color: "#64748B" },
  blogReviewTitle: { fontSize: 13, fontWeight: "600", color: "#F1F5F9", marginBottom: 4, lineHeight: 19 },
  blogReviewDesc: { fontSize: 12, color: "#94A3B8", lineHeight: 18, marginBottom: 8 },
  blogReviewFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  blogReviewMeta: { fontSize: 11, color: "#64748B", flex: 1 },
  blogReviewLink: { fontSize: 12, color: "#34D399", fontWeight: "600" },
  naverBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#03C75A",
    borderRadius: 12, paddingVertical: 12, marginBottom: 4,
  },
  naverBtnN: { fontSize: 14, fontWeight: "900", color: "#FFFFFF" },
  naverBtnLabel: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },

  // 독자 한줄평
  reviewSection: {
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    backgroundColor: "#0F172A",
    borderRadius: 12,
    borderWidth: 1, borderColor: "#334155",
    padding: 14,
  },
  reviewSectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  reviewSectionIcon: { fontSize: 15, color: "#FBBF24" },
  reviewSectionTitle: { fontSize: 14, fontWeight: "700", color: "#CBD5E1" },
  avgBadge: { flexDirection: "row", alignItems: "center", marginLeft: "auto" as any, backgroundColor: "#1E293B", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  avgBadgeText: { fontSize: 13, fontWeight: "700", color: "#FBBF24" },
  avgBadgeCount: { fontSize: 12, color: "#64748B" },
  myReviewForm: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginBottom: 12 },
  myReviewLabel: { fontSize: 12, fontWeight: "700", color: "#94A3B8", marginBottom: 8 },
  starRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 10 },
  starBtn: { fontSize: 24, color: "#334155" },
  starBtnActive: { color: "#FBBF24" },
  ratingLabel: { fontSize: 13, color: "#94A3B8", marginLeft: 4 },
  reviewInput: {
    backgroundColor: "#0F172A", borderRadius: 8,
    borderWidth: 1, borderColor: "#334155",
    color: "#F1F5F9", fontSize: 13, lineHeight: 20,
    padding: 10, minHeight: 60, textAlignVertical: "top",
  },
  charCount: { fontSize: 11, color: "#475569", textAlign: "right", marginTop: 4 },
  reviewBtnRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  reviewSubmitBtn: {
    flex: 1, backgroundColor: "#4F46E5", borderRadius: 8,
    paddingVertical: 10, alignItems: "center",
  },
  reviewSubmitBtnText: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
  reviewDeleteBtn: {
    backgroundColor: "#7F1D1D", borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 16, alignItems: "center",
  },
  reviewDeleteBtnText: { fontSize: 13, fontWeight: "700", color: "#FCA5A5" },
  loginPrompt: {
    flexDirection: "row", alignItems: "center", gap: 6,
    padding: 10, marginBottom: 10, justifyContent: "center",
  },
  loginPromptText: { fontSize: 13, color: "#64748B" },
  reviewsEmptyText: { fontSize: 12, color: "#64748B", textAlign: "center", paddingVertical: 10 },
  reviewCard: {
    backgroundColor: "#1E293B", borderRadius: 10,
    borderWidth: 1, borderColor: "#293548",
    padding: 12, marginBottom: 8,
  },
  reviewCardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  reviewerName: { fontSize: 12, fontWeight: "700", color: "#94A3B8" },
  meBadge: { backgroundColor: "#1D4ED8", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  meBadgeText: { fontSize: 10, fontWeight: "700", color: "#BFDBFE" },
  reviewStars: { fontSize: 12, color: "#FBBF24", marginLeft: "auto" as any },
  reviewText: { fontSize: 13, color: "#CBD5E1", lineHeight: 19, marginBottom: 4 },
  reviewDate: { fontSize: 11, color: "#475569" },
  showMoreBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: 8,
  },
  showMoreText: { fontSize: 13, color: "#818CF8", fontWeight: "600" },

  // 도서 소장 도서관
  librarySection: {
    marginHorizontal: 16, marginTop: 12, marginBottom: 16,
    backgroundColor: "#0F172A",
    borderRadius: 12,
    borderWidth: 1, borderColor: "#334155",
    overflow: "hidden",
  },
  libraryToggle: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14 },
  librarySectionIcon: { fontSize: 16 },
  libraryToggleText: { fontSize: 14, fontWeight: "700", color: "#CBD5E1" },
  libraryBody: { paddingHorizontal: 12, paddingBottom: 14 },

  // GPS 안내
  gpsSubtitle: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 10 },
  gpsSubtitleText: { fontSize: 11, color: "#64748B", flex: 1 },
  gpsSubtitleActive: { color: "#818CF8" },

  // 드롭다운
  dropdownRow: {
    flexDirection: "row", gap: 10, marginBottom: 12,
    backgroundColor: "#1E293B",
    borderRadius: 10, borderWidth: 1, borderColor: "#334155",
    padding: 12,
  },
  dropdownWrap: { flex: 1 },
  dropdownLabel: { fontSize: 11, color: "#64748B", marginBottom: 4 },
  dropdown: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, borderColor: "#475569",
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: "#0F172A",
  },
  dropdownValue: { fontSize: 13, color: "#CBD5E1", fontWeight: "500" },

  // 도서관 없음 / 더보기
  noLibText: { fontSize: 13, color: "#64748B", paddingVertical: 12, textAlign: "center", lineHeight: 20 },
  moreLibText: { fontSize: 12, color: "#64748B", marginTop: 4, textAlign: "center" },
  libSummaryText: {
    fontSize: 12, color: "#94A3B8", textAlign: "center",
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: "#334155",
  },

  // 닫기
  closeBtn: {
    marginHorizontal: 20, marginBottom: 32, marginTop: 8,
    backgroundColor: "#0F172A", borderRadius: 16,
    paddingVertical: 13, alignItems: "center",
    borderWidth: 1, borderColor: "#334155",
  },
  closeBtnText: { fontSize: 14, fontWeight: "700", color: "#F1F5F9" },
});
