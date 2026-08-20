import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { syncPushToken } from '../lib/notifications';

function goToBatchFromNotification(data: Record<string, unknown> | undefined) {
  const batchId = data?.batchId;
  if (typeof batchId === 'string') {
    router.push({ pathname: '/batches/[id]', params: { id: batchId } });
  }
}

export function usePushNotifications(session: Session | null) {
  useEffect(() => {
    if (!session) return;
    syncPushToken(session.user.id);
  }, [session?.user.id]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      goToBatchFromNotification(response.notification.request.content.data);
    });

    Notifications.getLastNotificationResponseAsync().then((response) => {
      goToBatchFromNotification(response?.notification.request.content.data);
    });

    return () => responseSubscription.remove();
  }, []);
}
