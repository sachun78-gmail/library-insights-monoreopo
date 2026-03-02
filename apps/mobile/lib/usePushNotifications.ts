import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "./api";

// 포그라운드에서 알림을 배너로 표시
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function requestPermissionAndGetToken(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("[Push] 에뮬레이터에서는 푸쉬 토큰을 발급할 수 없습니다.");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  console.log("[Push] 현재 권한 상태:", existingStatus);

  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    console.log("[Push] 권한 요청 중...");
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    console.log("[Push] 권한 요청 결과:", status);
  }

  if (finalStatus !== "granted") {
    console.log("[Push] 권한 거부됨. 토큰 발급 중단.");
    return null;
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    console.log("[Push] projectId:", projectId);
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log("[Push] 토큰 발급 성공:", tokenData.data);
    return tokenData.data;
  } catch (err) {
    console.log("[Push] 토큰 발급 실패:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * 앱 시작 시 한 번 호출하여 푸쉬 토큰을 서버에 등록합니다.
 * 로그인 상태일 때만 동작합니다.
 *
 * @param isLoggedIn 현재 로그인 여부
 */
export function usePushNotifications(isLoggedIn: boolean) {
  const registered = useRef(false);

  useEffect(() => {
    console.log("[Push] usePushNotifications 실행 - isLoggedIn:", isLoggedIn, "registered:", registered.current);
    if (!isLoggedIn || registered.current) return;

    (async () => {
      const token = await requestPermissionAndGetToken();
      if (!token) return;

      const platform = Platform.OS === "ios" ? "ios" : "android";
      try {
        await api.registerPushToken(token, platform);
        registered.current = true;
        console.log("[Push] 서버 토큰 등록 완료");
      } catch (err) {
        console.log("[Push] 서버 토큰 등록 실패:", err instanceof Error ? err.message : String(err));
      }
    })();
  }, [isLoggedIn]);
}
