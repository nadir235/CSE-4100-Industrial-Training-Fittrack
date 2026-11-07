import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { isFirebaseConfigured } from '../lib/firebase';
import { configureNotifications } from '../lib/notifications';
import { colors } from '../lib/theme';
import { DialogProvider, Loading } from '../components/ui';
import { PopupProvider } from '../components/popup';
import { SetupScreen } from '../components/SetupScreen';

function Gate() {
  const { user, role, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <Loading text="Loading FitTrack…" />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!user && role === 'member'}>
        <Stack.Screen name="(member)" />
      </Stack.Protected>
      <Stack.Protected guard={!!user && role === 'admin'}>
        <Stack.Screen name="(admin)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    configureNotifications();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {isFirebaseConfigured ? (
        <DialogProvider>
          <PopupProvider>
            <AuthProvider>
              <Gate />
            </AuthProvider>
          </PopupProvider>
        </DialogProvider>
      ) : (
        <SetupScreen />
      )}
    </SafeAreaProvider>
  );
}
