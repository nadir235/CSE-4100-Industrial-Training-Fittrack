import React from 'react';
import { ScrollView, View } from 'react-native';
import { AppText, Card, KeyValue } from './ui';
import { Logo } from './layout/Shell';
import { colors } from '../lib/theme';

export function SetupScreen() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 24, alignItems: 'center' }}>
      <View style={{ width: '100%', maxWidth: 640, paddingTop: 40 }}>
        <Logo />
        <AppText variant="h1" style={{ marginTop: 24 }}>
          Firebase is not configured yet
        </AppText>
        <AppText muted style={{ marginTop: 8, marginBottom: 20 }}>
          Create a Firebase project, add a Web app, enable Email/Password sign-in and Firestore, then copy the values into a <AppText color={colors.primary}>.env</AppText> file in the project root (see
          .env.example) and restart with <AppText color={colors.primary}>npx expo start -c</AppText>.
        </AppText>
        <Card>
          <KeyValue label="EXPO_PUBLIC_FIREBASE_API_KEY" value="required" />
          <KeyValue label="EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN" value="required" />
          <KeyValue label="EXPO_PUBLIC_FIREBASE_PROJECT_ID" value="required" />
          <KeyValue label="EXPO_PUBLIC_FIREBASE_APP_ID" value="required" />
          <KeyValue label="EXPO_PUBLIC_API_URL" value="backend URL" />
        </Card>
        <AppText variant="caption" muted style={{ marginTop: 16 }}>
          Full step-by-step instructions are in README.md.
        </AppText>
      </View>
    </ScrollView>
  );
}
