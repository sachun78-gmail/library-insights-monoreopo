import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

if (__DEV__ && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn("[Supabase] EXPO_PUBLIC_SUPABASE_URL 또는 KEY가 설정되지 않았습니다.");
}

// expo-secure-store 기반 스토리지 어댑터
// SecureStore 항목 크기 제한(2048B) 대응: 긴 값은 청크로 분할 저장
const CHUNK_SIZE = 1900;

const SecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const chunk0 = await SecureStore.getItemAsync(`${key}.0`);
      if (chunk0 === null) return SecureStore.getItemAsync(key);
      let result = chunk0;
      let i = 1;
      while (true) {
        const chunk = await SecureStore.getItemAsync(`${key}.${i}`);
        if (chunk === null) break;
        result += chunk;
        i++;
      }
      return result;
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (value.length <= CHUNK_SIZE) {
        await SecureStore.setItemAsync(key, value);
        return;
      }
      let i = 0;
      while (i * CHUNK_SIZE < value.length) {
        await SecureStore.setItemAsync(
          `${key}.${i}`,
          value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
        );
        i++;
      }
    } catch (e) {
      console.warn("[Supabase] SecureStore setItem 오류:", e);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
      let i = 0;
      while (true) {
        const exists = await SecureStore.getItemAsync(`${key}.${i}`);
        if (exists === null) break;
        await SecureStore.deleteItemAsync(`${key}.${i}`);
        i++;
      }
    } catch {
      // 무시
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
