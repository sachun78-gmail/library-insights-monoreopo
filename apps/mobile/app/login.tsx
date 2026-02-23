import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../lib/auth-context";

type Mode = "signin" | "signup";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signUp, signInWithGoogle, user } = useAuth();

  // 로그인 성공 시 (Google OAuth 딥링크 포함) 자동으로 화면 닫기
  useEffect(() => {
    if (user) {
      router.back();
    }
  }, [user]);

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMsg("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    const { error } =
      mode === "signin"
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);

    setIsLoading(false);

    if (error) {
      // 회원가입 후 이메일 인증 안내는 성공 메시지로 표시
      if (mode === "signup" && error.includes("인증 링크")) {
        setSuccessMsg(error);
      } else {
        setErrorMsg(error);
      }
    } else {
      router.back();
    }
  };

  const handleGoogle = async () => {
    setIsGoogleLoading(true);
    setErrorMsg("");
    const { error } = await signInWithGoogle();
    setIsGoogleLoading(false);
    if (error) {
      setErrorMsg(error);
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {/* Logo */}
            <View style={styles.logoRow}>
              <Ionicons name="book" size={28} color="#D97706" />
              <Text style={styles.logoText}>LibraryInsights</Text>
            </View>

            <Text style={styles.title}>
              {mode === "signin" ? "로그인" : "회원가입"}
            </Text>
            <Text style={styles.subtitle}>
              AI 추천 및 내 서재 기능을 이용하세요
            </Text>

            {/* Google 로그인 버튼 */}
            <TouchableOpacity
              style={styles.googleBtn}
              onPress={handleGoogle}
              disabled={isGoogleLoading || isLoading}
            >
              {isGoogleLoading ? (
                <ActivityIndicator size="small" color="#374151" />
              ) : (
                <>
                  <View style={styles.googleIcon}>
                    <Text style={styles.googleIconText}>G</Text>
                  </View>
                  <Text style={styles.googleBtnText}>Google로 계속하기</Text>
                </>
              )}
            </TouchableOpacity>

            {/* 구분선 */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>또는 이메일로 계속</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Mode toggle */}
            <View style={styles.modeRow}>
              {(["signin", "signup"] as Mode[]).map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => { setMode(m); setErrorMsg(""); setSuccessMsg(""); }}
                  style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      mode === m && styles.modeBtnTextActive,
                    ]}
                  >
                    {m === "signin" ? "로그인" : "회원가입"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>이메일</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color="#9CA3AF" />
                <TextInput
                  style={styles.input}
                  placeholder="이메일 주소 입력"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>비밀번호</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" />
                <TextInput
                  style={styles.input}
                  placeholder={mode === "signup" ? "6자 이상 입력" : "비밀번호 입력"}
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  onSubmitEditing={handleSubmit}
                  returnKeyType="done"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Error */}
            {errorMsg ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Success */}
            {successMsg ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle-outline" size={14} color="#059669" />
                <Text style={styles.successText}>{successMsg}</Text>
              </View>
            ) : null}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, isLoading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={isLoading || isGoogleLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>
                  {mode === "signin" ? "로그인" : "회원가입"}
                </Text>
              )}
            </TouchableOpacity>

            {/* Supabase Google 설정 안내 (개발 중) */}
            {__DEV__ && (
              <Text style={styles.devNote}>
                ℹ️ Google 로그인: Supabase 대시보드 → Authentication → URL Configuration에{"\n"}
                리다이렉트 URL로 `libraryinsights://login-callback` 추가 필요
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { paddingHorizontal: 20, paddingTop: 8 },
  backBtn: { padding: 4, alignSelf: "flex-start" },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },

  logoRow: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  logoText: { fontSize: 20, fontWeight: "bold", color: "#111827", marginLeft: 8 },
  title: { fontSize: 26, fontWeight: "bold", color: "#111827", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#6B7280", marginBottom: 24 },

  // Google 버튼
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  googleIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#4285F4",
    alignItems: "center",
    justifyContent: "center",
  },
  googleIconText: { color: "#FFFFFF", fontSize: 13, fontWeight: "bold" },
  googleBtnText: { fontSize: 15, fontWeight: "600", color: "#374151" },

  // 구분선
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  dividerText: { fontSize: 12, color: "#9CA3AF" },

  // Mode toggle
  modeRow: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  modeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  modeBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  modeBtnText: { fontSize: 14, color: "#6B7280", fontWeight: "500" },
  modeBtnTextActive: { color: "#111827", fontWeight: "600" },

  // Input
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: "#FAFAFA",
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    paddingVertical: 13,
    marginLeft: 10,
  },

  // Messages
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { fontSize: 13, color: "#DC2626", flex: 1, lineHeight: 18 },
  successBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#ECFDF5",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  successText: { fontSize: 13, color: "#059669", flex: 1, lineHeight: 18 },

  // Submit
  submitBtn: {
    backgroundColor: "#D97706",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  submitText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },

  devNote: {
    marginTop: 20,
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 16,
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 8,
  },
});
