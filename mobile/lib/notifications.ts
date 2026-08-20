import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  if (!Device.isDevice) {
    console.warn('Push notifikácie vyžadujú fyzické zariadenie.');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.warn('Povolenie pre push notifikácie nebolo udelené.');
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn('Chýba EAS projectId — spustite `eas init`, kým push notifikácie nebudú fungovať.');
    return null;
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  return token;
}

export async function syncPushToken(userId: string) {
  const token = await registerForPushNotificationsAsync();
  if (!token) return;

  const deviceId = Device.modelName ?? Platform.OS;
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ user_id: userId, expo_push_token: token, device_id: deviceId }, { onConflict: 'user_id,expo_push_token' });
  if (error) console.error('Nepodarilo sa uložiť push token', error);
}
