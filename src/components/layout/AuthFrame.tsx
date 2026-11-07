import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Icon } from '../ui';
import { Logo } from './Shell';
import { colors } from '../../lib/theme';
import { useBreakpoint } from '../../lib/useBreakpoint';

const PERKS = [
  ['dumbbell', 'Beginner to advanced workout programs'],
  ['robot-outline', 'AI coach that knows your progress'],
  ['timer-outline', 'Fasting, water and running trackers'],
  ['card-account-details-outline', 'Gym membership and payments in one place'],
];

export function AuthFrame({ children }: { children: React.ReactNode }) {
  const { isDesktop } = useBreakpoint();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg }}>
      {isDesktop ? (
        <View style={{ flex: 1, backgroundColor: colors.surface, padding: 56, justifyContent: 'center', borderRightWidth: 1, borderRightColor: colors.border }}>
          <Logo />
          <AppText variant="big" style={{ marginTop: 32, maxWidth: 480 }}>
            Train smarter.{'\n'}
            <AppText variant="big" color={colors.primary}>
              Manage your gym life.
            </AppText>
          </AppText>
          <View style={{ marginTop: 32, gap: 16 }}>
            {PERKS.map(([icon, text]) => (
              <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: colors.primary + '26', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={icon} color={colors.primary} />
                </View>
                <AppText muted>{text}</AppText>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      <ScrollView style={{ flex: isDesktop ? 1 : undefined, width: isDesktop ? undefined : '100%' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 440 }}>
          {!isDesktop ? (
            <View style={{ marginBottom: 28 }}>
              <Logo />
            </View>
          ) : null}
          {children}
        </View>
      </ScrollView>
    </View>
  );
}
