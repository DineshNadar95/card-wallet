import { type ApiClient, registerPushToken, unregisterPushToken } from "@card-wallet/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const KEY = "card-wallet.push-token";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Ask for notification permission and register this device's Expo push token with the API,
 * so expiry reminders arrive as push notifications. Returns quietly when push isn't possible
 * (simulator, permission denied, or no EAS project id yet).
 */
export async function registerForPush(api: ApiClient): Promise<void> {
  if (!Device.isDevice) return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) {
    console.info("Push reminders need an EAS project id (run `npx eas-cli init`).");
    return;
  }
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Offer reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await registerPushToken(api, token, Platform.OS === "ios" ? "ios" : "android");
  await AsyncStorage.setItem(KEY, token);
}

/** On sign-out, so a shared phone stops getting this user's reminders. */
export async function unregisterPush(api: ApiClient): Promise<void> {
  const token = await AsyncStorage.getItem(KEY);
  if (!token) return;
  try {
    await unregisterPushToken(api, token);
  } finally {
    await AsyncStorage.removeItem(KEY);
  }
}
