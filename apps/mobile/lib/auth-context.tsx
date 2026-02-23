import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "./supabase";

// OAuth 완료 처리 (앱으로 돌아올 때)
WebBrowser.maybeCompleteAuthSession();

// Google OAuth 리다이렉트 URI (app.json의 scheme)
const REDIRECT_URI = "libraryinsights://login-callback";

function authLog(...args: any[]) {
  if (__DEV__) {
    console.log("[AUTH][GOOGLE]", ...args);
  }
}

// OAuth 리다이렉트 URL에서 세션 처리 (공통 유틸)
async function handleOAuthUrl(url: string): Promise<boolean> {
  try {
    authLog("handleOAuthUrl:start", url);
    const hashParams = new URLSearchParams(url.split("#")[1] ?? "");
    const queryParams = new URLSearchParams(url.split("?")[1] ?? "");

    const access_token =
      hashParams.get("access_token") ?? queryParams.get("access_token");
    const refresh_token =
      hashParams.get("refresh_token") ?? queryParams.get("refresh_token");
    const code = hashParams.get("code") ?? queryParams.get("code");

    if (access_token) {
      authLog("handleOAuthUrl:token_found", {
        hasAccessToken: !!access_token,
        hasRefreshToken: !!refresh_token,
      });
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token: refresh_token ?? "",
      });
      authLog("handleOAuthUrl:setSession", error ? error.message : "ok");
      return !error;
    }

    if (code) {
      authLog("handleOAuthUrl:code_found");
      const { error } = await supabase.auth.exchangeCodeForSession(url);
      authLog("handleOAuthUrl:exchangeCodeForSession", error ? error.message : "ok");
      return !error;
    }

    authLog("handleOAuthUrl:no_token_or_code");
    return false;
  } catch (e: any) {
    authLog("handleOAuthUrl:error", e?.message ?? String(e));
    return false;
  }
}

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
    // 초기 세션 로드
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    // 세션 변경 감지
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    // Android: 딥링크로 OAuth 콜백 처리
    const linkingSub = Linking.addEventListener("url", ({ url }) => {
      if (url.startsWith(REDIRECT_URI)) {
        authLog("linking:event", url);
        handleOAuthUrl(url);
      }
    });

    // 앱이 딥링크로 시작된 경우 처리
    Linking.getInitialURL().then((url) => {
      if (url?.startsWith(REDIRECT_URI)) {
        authLog("linking:initialUrl", url);
        handleOAuthUrl(url);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
      linkingSub.remove();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
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
    if (data.user && !data.session) {
      return { error: "이메일로 인증 링크를 발송했습니다. 이메일 인증 후 로그인해주세요." };
    }
    return { error: null };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      authLog("signInWithGoogle:start", { redirectUri: REDIRECT_URI });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: REDIRECT_URI,
          skipBrowserRedirect: true,
        },
      });
      authLog("signInWithGoogle:oauthResponse", {
        hasUrl: !!data?.url,
        error: error?.message ?? null,
      });

      if (error || !data?.url) {
        return { error: error?.message ?? "Google 로그인 URL 생성 실패" };
      }

      // 브라우저에서 OAuth 진행
      // Android에서는 result.type이 'cancel'/'dismiss'로 올 수 있음 (정상)
      authLog("signInWithGoogle:oauthUrl", data.url);
      const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI);
      authLog("signInWithGoogle:webBrowserResult", result);

      // iOS: 브라우저가 URL을 직접 반환하는 경우
      if (result.type === "success") {
        const ok = await handleOAuthUrl(result.url);
        authLog("signInWithGoogle:iosSuccessHandled", ok);
        if (ok) return { error: null };
      }

      // Android: 딥링크 리스너가 처리했는지 세션 확인
      // (브라우저가 닫힌 후 세션이 설정되었을 수 있음)
      await new Promise((r) => setTimeout(r, 800));
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      authLog("signInWithGoogle:sessionAfterBrowser", {
        hasSession: !!currentSession,
        userId: currentSession?.user?.id ?? null,
      });
      if (currentSession) return { error: null };

      // 사용자가 취소한 경우
      if (result.type === "cancel" || result.type === "dismiss") {
        return { error: null };
      }

      return { error: "Google 로그인이 완료되지 않았습니다." };
    } catch (e: any) {
      authLog("signInWithGoogle:catch", e?.message ?? String(e));
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
