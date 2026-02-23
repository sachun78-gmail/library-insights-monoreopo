import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../lib/auth-context";

type Mode = "signin" | "signup";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMsg("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    setIsLoading(true);
    setErrorMsg("");

    const { error } =
      mode === "signin"
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);

    setIsLoading(false);
    if (error) {
      setErrorMsg(error);
    } else {
      if (mode === "signup") {
        Alert.alert(
          "회원가입 완료",
          "이메일 인증 후 로그인해주세요.",
          [{ text: "확인", onPress: () => router.back() }]
        );
      } else {
        router.back();
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
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
            {mode === "signin"
              ? "AI 추천 및 내 서재 기능을 이용하세요"
              : "계정을 만들어 서비스를 이용하세요"}
          </Text>

          {/* Mode toggle */}
          <View style={styles.modeRow}>
            {(["signin", "signup"] as Mode[]).map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => { setMode(m); setErrorMsg(""); }}
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

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, isLoading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitText}>
                {mode === "signin" ? "로그인" : "회원가입"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { paddingHorizontal: 20, paddingTop: 8 },
  backBtn: { padding: 4, alignSelf: "flex-start" },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  logoRow: { flexDirection: "row", alignItems: "center", marginBottom: 32 },
  logoText: { fontSize: 20, fontWeight: "bold", color: "#111827", marginLeft: 8 },
  title: { fontSize: 26, fontWeight: "bold", color: "#111827", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#6B7280", marginBottom: 28 },

  modeRow: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    padding: 4,
    marginBottom: 28,
  },
  modeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  modeBtnActive: { backgroundColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  modeBtnText: { fontSize: 14, color: "#6B7280", fontWeight: "500" },
  modeBtnTextActive: { color: "#111827", fontWeight: "600" },

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
  input: { flex: 1, fontSize: 15, color: "#111827", paddingVertical: 13, marginLeft: 10 },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { fontSize: 13, color: "#DC2626", flex: 1 },

  submitBtn: {
    backgroundColor: "#D97706",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  submitText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
});
