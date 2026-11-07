import { Stack } from 'expo-router';
import { colors } from '../../../lib/theme';

export default function WorkoutsLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
