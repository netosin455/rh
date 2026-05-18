// ============================================================
// componentes/PushProvider.native.tsx — iOS e Android apenas
// Solicita permissão, registra token Expo e ouve notificações
// ============================================================

import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { apiFetch } from '../conexoes/http';
import { useAuth } from '../contextos/Autenticacao';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
  }),
});

export function PushProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router   = useRouter();
  const notifListener    = useRef<ReturnType<typeof Notifications.addNotificationReceivedListener>>();
  const responseListener = useRef<ReturnType<typeof Notifications.addNotificationResponseReceivedListener>>();

  useEffect(() => {
    if (!user) return;

    async function registerToken() {
      try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        const tokenData = await Notifications.getExpoPushTokenAsync();
        await apiFetch('/api/push', {
          method: 'POST',
          body:   JSON.stringify({ token: tokenData.data, platform: Platform.OS }),
        });
      } catch {
        // Falha silenciosa — push é não-crítico
      }
    }

    registerToken();

    notifListener.current = Notifications.addNotificationReceivedListener(() => {});

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const route = response.notification.request.content.data?.route as string | undefined;
      if (route) router.push(route as any);
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [user]);

  return <>{children}</>;
}
