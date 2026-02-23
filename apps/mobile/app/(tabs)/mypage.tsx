import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth-context";
import { api } from "../../lib/api";
import type { UserProfile } from "../../lib/types";

const REGIONS = [
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

const GENDERS = [
  { value: "M", label: "남성" },
  { value: "F", label: "여성" },
];

export default function MyPageScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedGender, setSelectedGender] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["profile", user?.id],
    queryFn: () => api.profile(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    onSuccess: (data) => {
      setSelectedGender(data.gender);
      setSelectedRegion(data.region_code);
    },
  } as any);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateProfile(user!.id, {
        gender: selectedGender ?? undefined,
        region_code: selectedRegion ?? undefined,
        region_name:
          REGIONS.find((r) => r.code === selectedRegion)?.name ?? undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      setIsEditing(false);
    },
    onError: () => Alert.alert("오류", "저장에 실패했습니다."),
  });

  const handleSignOut = () => {
    Alert.alert("로그아웃", "로그아웃 하시겠습니까?", [
      { text: "취소", style: "cancel" },
      { text: "로그아웃", style: "destructive", onPress: signOut },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "계정 삭제",
      "계정을 삭제하면 모든 데이터가 사라집니다. 계속하시겠습니까?",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            await api.deleteAccount(user!.id);
            await signOut();
          },
        },
      ]
    );
  };

  // 로그인 유도
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBox}>
          <Ionicons name="person-outline" size={64} color="#D97706" />
          <Text style={styles.emptyTitle}>마이페이지</Text>
          <Text style={styles.emptySubtitle}>
            로그인하면 프로필을 관리할 수 있습니다
          </Text>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.loginBtnText}>로그인하기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>마이페이지</Text>
          {!isEditing ? (
            <TouchableOpacity
              onPress={() => setIsEditing(true)}
              style={styles.editBtn}
            >
              <Ionicons name="pencil-outline" size={16} color="#D97706" />
              <Text style={styles.editBtnText}>편집</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={() => setIsEditing(false)}
                style={[styles.editBtn, { borderColor: "#9CA3AF" }]}
              >
                <Text style={[styles.editBtnText, { color: "#6B7280" }]}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => updateMutation.mutate()}
                style={[styles.editBtn, { backgroundColor: "#D97706", borderColor: "#D97706" }]}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.editBtnText, { color: "#fff" }]}>저장</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={36} color="#D97706" />
          </View>
          <View>
            <Text style={styles.emailText}>{user.email}</Text>
            {profile?.region_name && (
              <Text style={styles.regionText}>📍 {profile.region_name}</Text>
            )}
          </View>
        </View>

        {isLoading && (
          <View style={{ paddingVertical: 32, alignItems: "center" }}>
            <ActivityIndicator color="#D97706" />
          </View>
        )}

        {/* 성별 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>성별</Text>
          {isEditing ? (
            <View style={styles.chipRow}>
              {GENDERS.map((g) => (
                <TouchableOpacity
                  key={g.value}
                  onPress={() => setSelectedGender(g.value)}
                  style={[
                    styles.chip,
                    selectedGender === g.value && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedGender === g.value && styles.chipTextActive,
                    ]}
                  >
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.sectionValue}>
              {profile?.gender === "M"
                ? "남성"
                : profile?.gender === "F"
                ? "여성"
                : "미설정"}
            </Text>
          )}
        </View>

        {/* 지역 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>선호 지역</Text>
          {isEditing ? (
            <View style={styles.chipRow}>
              {REGIONS.map((r) => (
                <TouchableOpacity
                  key={r.code}
                  onPress={() => setSelectedRegion(r.code)}
                  style={[
                    styles.chip,
                    selectedRegion === r.code && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedRegion === r.code && styles.chipTextActive,
                    ]}
                  >
                    {r.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.sectionValue}>
              {profile?.region_name ?? "미설정"}
            </Text>
          )}
        </View>

        {/* 내 서재 바로가기 */}
        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => router.push("/(tabs)/bookshelf")}
        >
          <Ionicons name="bookmark-outline" size={20} color="#374151" />
          <Text style={styles.menuText}>내 서재</Text>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" style={{ marginLeft: "auto" }} />
        </TouchableOpacity>

        {/* 로그아웃 */}
        <TouchableOpacity style={styles.menuRow} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#374151" />
          <Text style={styles.menuText}>로그아웃</Text>
        </TouchableOpacity>

        {/* 계정 삭제 */}
        <TouchableOpacity
          style={[styles.menuRow, { marginTop: 8 }]}
          onPress={handleDeleteAccount}
        >
          <Ionicons name="trash-outline" size={20} color="#DC2626" />
          <Text style={[styles.menuText, { color: "#DC2626" }]}>계정 삭제</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#374151", marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#9CA3AF", textAlign: "center", lineHeight: 20 },
  loginBtn: {
    marginTop: 24,
    backgroundColor: "#D97706",
    paddingHorizontal: 32,
    paddingVertical: 13,
    borderRadius: 12,
  },
  loginBtnText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
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

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  emailText: { fontSize: 15, fontWeight: "600", color: "#111827" },
  regionText: { fontSize: 13, color: "#6B7280", marginTop: 4 },

  section: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  sectionLabel: { fontSize: 12, fontWeight: "600", color: "#9CA3AF", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  sectionValue: { fontSize: 15, color: "#374151" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  chipActive: { borderColor: "#D97706", backgroundColor: "#FEF3C7" },
  chipText: { fontSize: 13, color: "#6B7280" },
  chipTextActive: { color: "#92400E", fontWeight: "600" },

  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  menuText: { fontSize: 15, color: "#374151", fontWeight: "500" },
});
