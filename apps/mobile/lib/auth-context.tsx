import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";

// OAuth 완료 처리 (앱으로 돌아올 때)
WebBrowser.maybeCompleteAuthSession();

// Google OAuth 리다이렉트 URI (app.json의 scheme)
const REDIRECT_URI = "libraryinsights://login-callback";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  isLoading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // 사용자에게 친숙한 에러 메시지로 변환
      if (error.message.includes("Invalid login credentials")) {
        return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
      }
      if (error.message.includes("Email not confirmed")) {
        return { error: "이메일 인증이 필요합니다. 받은 메일함을 확인해주세요." };
      }
      return { error: error.message };
    }
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    // 이메일 인증이 필요한 경우
    if (data.user && !data.session) {
      return { error: "이메일로 인증 링크를 발송했습니다. 이메일 인증 후 로그인해주세요." };
    }
    return { error: null };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: REDIRECT_URI,
          skipBrowserRedirect: true,
        },
      });

      if (error || !data?.url) {
        return { error: error?.message ?? "Google 로그인 URL 생성 실패" };
      }

      // 브라우저에서 OAuth 진행
      const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI);

      if (result.type !== "success") {
        return { error: result.type === "cancel" ? null : "Google 로그인이 취소됐습니다." };
      }

      // URL에서 토큰 추출 (hash 또는 query params)
      const url = result.url;
      const hashParams = new URLSearchParams(url.split("#")[1] ?? "");
      const queryParams = new URLSearchParams(url.split("?")[1] ?? "");

      const access_token =
        hashParams.get("access_token") ?? queryParams.get("access_token");
      const refresh_token =
        hashParams.get("refresh_token") ?? queryParams.get("refresh_token");

      if (access_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token: refresh_token ?? "",
        });
        if (sessionError) return { error: sessionError.message };
        return { error: null };
      }

      // PKCE 코드 플로우
      const code = hashParams.get("code") ?? queryParams.get("code");
      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(url);
        if (exchangeError) return { error: exchangeError.message };
        return { error: null };
      }

      return { error: "인증 정보를 가져오지 못했습니다." };
    } catch (e: any) {
      return { error: e?.message ?? "Google 로그인 중 오류가 발생했습니다." };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        isLoading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
