import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText, Button } from '../components/ui';
import { colors } from '../lib/theme';

export default function NotFound() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <AppText variant="big">404</AppText>
      <AppText muted style={{ marginVertical: 12 }}>
        This page doesn't exist, or you don't have access to it.
      </AppText>
      <Button title="Go to start" onPress={() => router.replace('/')} />
    </View>
  );
}
