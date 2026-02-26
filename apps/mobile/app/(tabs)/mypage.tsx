import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth-context";
import { api } from "../../lib/api";
import { AppBackground } from "../../components/AppBackground";
import { isKorean } from "../../lib/i18n";
import type { UserProfile } from "../../lib/types";
import { regions as regionsData } from "../../../../apps/web/src/data/regions.js";

function getImagePickerModule(): any | null {
  try {
    const req = (globalThis as any).eval?.("require") ?? require;
    return req("expo-image-picker");
  } catch {
    return null;
  }
}

const REGIONS = [
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

const GENDERS = [
  { value: "male", label: "Male", labelKo: "남성" },
  { value: "female", label: "Female", labelKo: "여성" },
  { value: "other", label: "Other", labelKo: "기타" },
];

type RegionDataItem = {
  code: string;
  name: string;
  subRegions?: { code: string; name: string }[];
};

function formatJoinDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return isKorean
    ? `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`
    : date.toLocaleDateString();
}

function displayRegionName(code?: string | null, fallbackName?: string | null) {
  const match = REGIONS.find((r) => r.code === code);
  if (match) return isKorean ? match.nameKo : match.name;
  return fallbackName ?? "-";
}

function normalizeBirthDateInput(value: string): string {
  return value.trim().replace(/[./]/g, "-");
}

function normalizeGenderValue(value?: string | null): string | null {
  if (!value) return null;
  if (value === "M") return "male";
  if (value === "F") return "female";
  return value;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function parseBirthDateParts(value?: string | null) {
  const normalized = normalizeBirthDateInput(value ?? "");
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function isValidBirthDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

export default function MyPageScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [selectedGender, setSelectedGender] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedSubRegion, setSelectedSubRegion] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [regionPickerVisible, setRegionPickerVisible] = useState(false);
  const [subRegionPickerVisible, setSubRegionPickerVisible] = useState(false);
  const [birthDatePickerVisible, setBirthDatePickerVisible] = useState(false);
  const [birthDraftYear, setBirthDraftYear] = useState<number>(1990);
  const [birthDraftMonth, setBirthDraftMonth] = useState<number>(1);
  const [birthDraftDay, setBirthDraftDay] = useState<number>(1);

  const accountName = useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, any>;
    return meta.full_name || meta.name || user?.email?.split("@")[0] || "-";
  }, [user]);

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["profile", user?.id],
    queryFn: () => api.profile(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!profile) return;
    setSelectedGender(normalizeGenderValue(profile.gender));
    setSelectedRegion(profile.region_code ?? null);
    setSelectedSubRegion(profile.sub_region_code ?? null);
    setBirthDate(profile.birth_date ?? "");
    setAvatarUrl(profile.avatar_url ?? null);
  }, [profile]);

  const uploadImageMutation = useMutation({
    mutationFn: async () => {
      const ImagePicker = getImagePickerModule();
      if (!ImagePicker) {
        throw new Error(
          isKorean
            ? "expo-image-picker 패키지가 설치되지 않았습니다. 설치 후 다시 시도해주세요."
            : "expo-image-picker is not installed. Please install it and try again."
        );
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error(isKorean ? "사진 접근 권한이 필요합니다." : "Media library permission is required.");
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"] as any,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) {
        return null;
      }

      const asset = result.assets[0];
      const uploadedUrl = await api.uploadProfileImage(user!.id, {
        uri: asset.uri,
        name: asset.fileName ?? `profile_${Date.now()}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
      });
      return uploadedUrl;
    },
    onSuccess: (url) => {
      if (url) setAvatarUrl(url);
    },
    onError: (error: any) => {
      Alert.alert(
        isKorean ? "오류" : "Error",
        error?.message ?? (isKorean ? "이미지 업로드에 실패했습니다." : "Failed to upload image.")
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      const normalizedBirthDate = normalizeBirthDateInput(birthDate);
      if (normalizedBirthDate && !isValidBirthDate(normalizedBirthDate)) {
        throw new Error(isKorean ? "생년월일 형식은 YYYY-MM-DD로 입력해주세요." : "Birth date must be in YYYY-MM-DD format.");
      }

      return api.updateProfile(user!.id, {
        birth_date: normalizedBirthDate || undefined,
        gender: selectedGender ?? undefined,
        region_code: selectedRegion ?? undefined,
        region_name: REGIONS.find((r) => r.code === selectedRegion)?.nameKo ?? undefined,
        sub_region_code: selectedSubRegion ?? undefined,
        sub_region_name:
          ((regionsData as RegionDataItem[])
            .find((r) => r.code === selectedRegion)
            ?.subRegions ?? [])
            .find((s) => s.code === selectedSubRegion)?.name ?? undefined,
        avatar_url: avatarUrl ?? undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      setIsEditing(false);
      Alert.alert(isKorean ? "저장 완료" : "Saved", isKorean ? "프로필이 저장되었습니다." : "Profile has been saved.");
    },
    onError: (error: any) =>
      Alert.alert(
        isKorean ? "오류" : "Error",
        error?.message ?? (isKorean ? "프로필 저장에 실패했습니다." : "Failed to save profile.")
      ),
  });

  const handleSignOut = () => {
    Alert.alert(
      isKorean ? "로그아웃" : "Sign out",
      isKorean ? "로그아웃 하시겠습니까?" : "Do you want to sign out?",
      [
        { text: isKorean ? "취소" : "Cancel", style: "cancel" },
        { text: isKorean ? "로그아웃" : "Sign out", style: "destructive", onPress: () => void signOut() },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      isKorean ? "계정 삭제" : "Delete account",
      isKorean
        ? "계정을 삭제하면 모든 데이터가 삭제됩니다. 계속하시겠습니까?"
        : "Deleting your account will remove all data. Continue?",
      [
        { text: isKorean ? "취소" : "Cancel", style: "cancel" },
        {
          text: isKorean ? "삭제" : "Delete",
          style: "destructive",
          onPress: async () => {
            await api.deleteAccount(user!.id);
            await signOut();
          },
        },
      ]
    );
  };

  const resetEditableState = () => {
    setSelectedGender(normalizeGenderValue(profile?.gender));
    setSelectedRegion(profile?.region_code ?? null);
    setSelectedSubRegion(profile?.sub_region_code ?? null);
    setBirthDate(profile?.birth_date ?? "");
    setAvatarUrl(profile?.avatar_url ?? null);
    setIsEditing(false);
  };

  const selectedRegionData = (regionsData as RegionDataItem[]).find((r) => r.code === selectedRegion);
  const subRegionOptions = (selectedRegionData?.subRegions ?? []).map((s) => ({
    label: s.name,
    value: s.code,
  }));
  const selectedSubRegionName =
    subRegionOptions.find((s) => s.value === selectedSubRegion)?.label ??
    profile?.sub_region_name ??
    "-";

  const openBirthDatePicker = () => {
    const parsed = parseBirthDateParts(birthDate);
    const base = parsed ?? { year: 1990, month: 1, day: 1 };
    setBirthDraftYear(base.year);
    setBirthDraftMonth(base.month);
    setBirthDraftDay(base.day);
    setBirthDatePickerVisible(true);
  };

  const confirmBirthDate = () => {
    setBirthDate(`${birthDraftYear}-${pad2(birthDraftMonth)}-${pad2(birthDraftDay)}`);
    setBirthDatePickerVisible(false);
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <AppBackground>
          <View style={styles.centerBox}>
            <Ionicons name="person-outline" size={64} color="#D97706" />
            <Text style={styles.emptyTitle}>{isKorean ? "마이페이지" : "My Page"}</Text>
            <Text style={styles.emptySubtitle}>
              {isKorean ? "로그인하면 계정과 프로필 정보를 관리할 수 있습니다." : "Sign in to manage account and profile information."}
            </Text>
            <TouchableOpacity style={styles.loginBtn} onPress={() => router.push("/login")}>
              <Text style={styles.loginBtnText}>{isKorean ? "로그인" : "Log in"}</Text>
            </TouchableOpacity>
          </View>
        </AppBackground>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{isKorean ? "마이페이지" : "My Page"}</Text>
            {!isEditing ? (
              <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editBtn}>
                <Ionicons name="pencil-outline" size={16} color="#D97706" />
                <Text style={styles.editBtnText}>{isKorean ? "편집" : "Edit"}</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity onPress={resetEditableState} style={[styles.editBtn, { borderColor: "#9CA3AF" }]}>
                  <Text style={[styles.editBtnText, { color: "#6B7280" }]}>{isKorean ? "취소" : "Cancel"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => updateMutation.mutate()}
                  style={[styles.editBtn, { backgroundColor: "#D97706", borderColor: "#D97706" }]}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={[styles.editBtnText, { color: "#fff" }]}>{isKorean ? "저장" : "Save"}</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.heroCard}>
            <TouchableOpacity
              style={styles.avatarWrap}
              activeOpacity={isEditing ? 0.8 : 1}
              onPress={() => {
                if (!isEditing || uploadImageMutation.isPending) return;
                uploadImageMutation.mutate();
              }}
              disabled={!isEditing || uploadImageMutation.isPending}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarCircle}>
                  <Ionicons name="person" size={36} color="#D97706" />
                </View>
              )}
              {isEditing && (
                <View style={styles.avatarBadge}>
                  {uploadImageMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="camera" size={14} color="#fff" />
                  )}
                </View>
              )}
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.heroName}>{String(accountName)}</Text>
              <Text style={styles.heroEmail}>{user.email}</Text>
              <Text style={styles.heroMeta}>
                {isKorean ? "가입일" : "Joined"}: {formatJoinDate((user as any)?.created_at)}
              </Text>
            </View>
          </View>

          {isLoading && (
            <View style={{ paddingVertical: 24, alignItems: "center" }}>
              <ActivityIndicator color="#D97706" />
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{isKorean ? "프로필정보" : "Profile Info"}</Text>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{isKorean ? "생년월일" : "Birth Date"}</Text>
              {isEditing ? (
                <TouchableOpacity style={styles.selectBox} onPress={openBirthDatePicker}>
                  <Text style={styles.selectLabel}>{isKorean ? "생년월일 선택" : "Select birth date"}</Text>
                  <View style={styles.selectRow}>
                    <Text style={styles.selectValue} numberOfLines={1}>
                      {birthDate || (isKorean ? "날짜를 선택하세요" : "Choose a date")}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color="#94A3B8" />
                  </View>
                </TouchableOpacity>
              ) : (
                <Text style={styles.fieldValue}>{profile?.birth_date || "-"}</Text>
              )}
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{isKorean ? "성별" : "Gender"}</Text>
              {isEditing ? (
                <View style={styles.chipRow}>
                  {GENDERS.map((g) => (
                    <TouchableOpacity
                      key={g.value}
                      onPress={() => setSelectedGender(g.value)}
                      style={[styles.chip, selectedGender === g.value && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, selectedGender === g.value && styles.chipTextActive]}>
                        {isKorean ? g.labelKo : g.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.fieldValue}>
                  {selectedGender === "male"
                    ? isKorean ? "남성" : "Male"
                    : selectedGender === "female"
                    ? isKorean ? "여성" : "Female"
                    : selectedGender === "other"
                    ? isKorean ? "기타" : "Other"
                    : "-"}
                </Text>
              )}
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{isKorean ? "지역" : "Region"}</Text>
              {isEditing ? (
                <View style={{ gap: 8 }}>
                  <TouchableOpacity style={styles.selectBox} onPress={() => setRegionPickerVisible(true)}>
                    <Text style={styles.selectLabel}>{isKorean ? "지역" : "Region"}</Text>
                    <View style={styles.selectRow}>
                      <Text style={styles.selectValue} numberOfLines={1}>
                        {displayRegionName(selectedRegion, profile?.region_name)}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color="#94A3B8" />
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.selectBox, !selectedRegion && styles.selectBoxDisabled]}
                    onPress={() => selectedRegion && setSubRegionPickerVisible(true)}
                    disabled={!selectedRegion}
                  >
                    <Text style={styles.selectLabel}>{isKorean ? "세부지역" : "Sub-region"}</Text>
                    <View style={styles.selectRow}>
                      <Text style={styles.selectValue} numberOfLines={1}>
                        {selectedSubRegionName}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color="#94A3B8" />
                    </View>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.fieldValue}>
                  {displayRegionName(selectedRegion, profile?.region_name)}
                  {selectedSubRegionName !== "-" ? ` / ${selectedSubRegionName}` : ""}
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity style={styles.menuRow} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color="#94A3B8" />
            <Text style={styles.menuText}>{isKorean ? "로그아웃" : "Sign out"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuRow, { marginTop: 8 }]} onPress={handleDeleteAccount}>
            <Ionicons name="trash-outline" size={20} color="#DC2626" />
            <Text style={[styles.menuText, { color: "#DC2626" }]}>{isKorean ? "계정 삭제" : "Delete account"}</Text>
          </TouchableOpacity>
        </ScrollView>

        <SelectModal
          visible={regionPickerVisible}
          title={isKorean ? "지역 선택" : "Select region"}
          options={REGIONS.map((r) => ({ label: isKorean ? r.nameKo : r.name, value: r.code }))}
          value={selectedRegion ?? ""}
          onClose={() => setRegionPickerVisible(false)}
          onChange={(value) => {
            setSelectedRegion(value);
            setSelectedSubRegion(null);
            setRegionPickerVisible(false);
          }}
        />

        <SelectModal
          visible={subRegionPickerVisible}
          title={isKorean ? "세부지역 선택" : "Select sub-region"}
          options={subRegionOptions}
          value={selectedSubRegion ?? ""}
          onClose={() => setSubRegionPickerVisible(false)}
          onChange={(value) => {
            setSelectedSubRegion(value);
            setSubRegionPickerVisible(false);
          }}
        />

        <DatePickerModal
          visible={birthDatePickerVisible}
          year={birthDraftYear}
          month={birthDraftMonth}
          day={birthDraftDay}
          onClose={() => setBirthDatePickerVisible(false)}
          onClear={() => {
            setBirthDate("");
            setBirthDatePickerVisible(false);
          }}
          onConfirm={confirmBirthDate}
          onChangeYear={(year) => {
            setBirthDraftYear(year);
            setBirthDraftDay((prev) => Math.min(prev, getDaysInMonth(year, birthDraftMonth)));
          }}
          onChangeMonth={(month) => {
            setBirthDraftMonth(month);
            setBirthDraftDay((prev) => Math.min(prev, getDaysInMonth(birthDraftYear, month)));
          }}
          onChangeDay={setBirthDraftDay}
        />
      </AppBackground>
    </SafeAreaView>
  );
}

function SelectModal({
  visible,
  title,
  options,
  value,
  onClose,
  onChange,
}: {
  visible: boolean;
  title: string;
  options: { label: string; value: string }[];
  value: string;
  onClose: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 320 }}>
            {options.length === 0 ? (
              <Text style={styles.modalEmptyText}>{isKorean ? "선택 가능한 항목이 없습니다." : "No options available."}</Text>
            ) : (
              options.map((opt) => {
                const selected = opt.value === value;
                return (
                  <TouchableOpacity
                    key={`${title}-${opt.value}`}
                    style={[styles.modalOption, selected && styles.modalOptionSelected]}
                    onPress={() => onChange(opt.value)}
                  >
                    <Text style={[styles.modalOptionText, selected && styles.modalOptionTextSelected]}>{opt.label}</Text>
                    {selected && <Ionicons name="checkmark" size={16} color="#A5B4FC" />}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DatePickerModal({
  visible,
  year,
  month,
  day,
  onClose,
  onClear,
  onConfirm,
  onChangeYear,
  onChangeMonth,
  onChangeDay,
}: {
  visible: boolean;
  year: number;
  month: number;
  day: number;
  onClose: () => void;
  onClear: () => void;
  onConfirm: () => void;
  onChangeYear: (value: number) => void;
  onChangeMonth: (value: number) => void;
  onChangeDay: (value: number) => void;
}) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1919 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isKorean ? "생년월일 선택" : "Select birth date"}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <View style={styles.datePickerGrid}>
            <View style={styles.datePickerColumn}>
              <Text style={styles.datePickerColumnTitle}>{isKorean ? "연도" : "Year"}</Text>
              <ScrollView style={styles.datePickerList}>
                {years.map((value) => (
                  <TouchableOpacity
                    key={`y-${value}`}
                    style={[styles.datePickerItem, year === value && styles.datePickerItemActive]}
                    onPress={() => onChangeYear(value)}
                  >
                    <Text style={[styles.datePickerItemText, year === value && styles.datePickerItemTextActive]}>
                      {value}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.datePickerColumn}>
              <Text style={styles.datePickerColumnTitle}>{isKorean ? "월" : "Month"}</Text>
              <ScrollView style={styles.datePickerList}>
                {months.map((value) => (
                  <TouchableOpacity
                    key={`m-${value}`}
                    style={[styles.datePickerItem, month === value && styles.datePickerItemActive]}
                    onPress={() => onChangeMonth(value)}
                  >
                    <Text style={[styles.datePickerItemText, month === value && styles.datePickerItemTextActive]}>
                      {value}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.datePickerColumn}>
              <Text style={styles.datePickerColumnTitle}>{isKorean ? "일" : "Day"}</Text>
              <ScrollView style={styles.datePickerList}>
                {days.map((value) => (
                  <TouchableOpacity
                    key={`d-${value}`}
                    style={[styles.datePickerItem, day === value && styles.datePickerItemActive]}
                    onPress={() => onChangeDay(value)}
                  >
                    <Text style={[styles.datePickerItemText, day === value && styles.datePickerItemTextActive]}>
                      {value}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.datePickerActions}>
            <TouchableOpacity style={[styles.editBtn, { borderColor: "#6B7280" }]} onPress={onClear}>
              <Text style={[styles.editBtnText, { color: "#CBD5E1" }]}>{isKorean ? "초기화" : "Clear"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editBtn, { backgroundColor: "#D97706", borderColor: "#D97706" }]}
              onPress={onConfirm}
            >
              <Text style={[styles.editBtnText, { color: "#fff" }]}>{isKorean ? "확인" : "Confirm"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#071426" },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#F1F5F9", marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#64748B", textAlign: "center", lineHeight: 20 },
  loginBtn: { marginTop: 24, backgroundColor: "#D97706", paddingHorizontal: 32, paddingVertical: 13, borderRadius: 12 },
  loginBtnText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(15,23,42,0.84)",
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#F1F5F9" },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#D97706",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editBtnText: { fontSize: 13, color: "#D97706", fontWeight: "600" },

  heroCard: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    backgroundColor: "#1E293B",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
  },
  avatarWrap: { width: 72, height: 72, position: "relative" },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#292524",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#0F172A" },
  avatarBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#1E293B",
  },
  heroName: { fontSize: 16, fontWeight: "700", color: "#F1F5F9" },
  heroEmail: { fontSize: 12, color: "#CBD5E1", marginTop: 2 },
  heroMeta: { fontSize: 12, color: "#94A3B8", marginTop: 6 },

  section: {
    backgroundColor: "#1E293B",
    marginHorizontal: 16,
    marginTop: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#334155",
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#F1F5F9", marginBottom: 10 },

  fieldBlock: { marginTop: 10 },
  fieldLabel: { fontSize: 12, color: "#94A3B8", marginBottom: 8 },
  fieldValue: { fontSize: 14, color: "#E2E8F0" },
  textInput: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#E2E8F0",
    fontSize: 14,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0F172A",
  },
  chipActive: { borderColor: "#D97706", backgroundColor: "#292524" },
  chipText: { fontSize: 13, color: "#94A3B8" },
  chipTextActive: { color: "#FCD34D", fontWeight: "600" },
  selectBox: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectBoxDisabled: { opacity: 0.5 },
  selectLabel: { fontSize: 11, color: "#94A3B8", marginBottom: 6 },
  selectRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  selectValue: { flex: 1, fontSize: 14, color: "#E2E8F0" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.55)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#0F172A",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  modalTitle: { fontSize: 14, fontWeight: "700", color: "#F1F5F9" },
  modalEmptyText: { color: "#94A3B8", fontSize: 13, padding: 14 },
  modalOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  modalOptionSelected: { backgroundColor: "rgba(79,70,229,0.16)" },
  modalOptionText: { color: "#CBD5E1", fontSize: 13, flex: 1 },
  modalOptionTextSelected: { color: "#E0E7FF", fontWeight: "600" },
  datePickerGrid: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  datePickerColumn: { flex: 1 },
  datePickerColumnTitle: {
    fontSize: 12,
    color: "#94A3B8",
    marginBottom: 8,
    textAlign: "center",
  },
  datePickerList: {
    maxHeight: 220,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 10,
  },
  datePickerItem: {
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.08)",
  },
  datePickerItemActive: {
    backgroundColor: "rgba(79,70,229,0.16)",
  },
  datePickerItemText: {
    color: "#CBD5E1",
    fontSize: 13,
  },
  datePickerItemTextActive: {
    color: "#E0E7FF",
    fontWeight: "700",
  },
  datePickerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
    marginTop: 10,
  },

  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1E293B",
    marginHorizontal: 16,
    marginTop: 10,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  menuText: { fontSize: 15, color: "#CBD5E1", fontWeight: "500" },
});
