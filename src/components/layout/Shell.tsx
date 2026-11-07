import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Avatar, Button, Icon, Sheet, useDialog } from '../ui';
import { useAuth } from '../../lib/auth';
import { colors, radius, spacing } from '../../lib/theme';
import { useBreakpoint } from '../../lib/useBreakpoint';

export type NavItem = {
  label: string;
  icon: string;
  href: string;
  /** shown in the desktop/tablet sidebar */
  side?: boolean;
  /** shown in the mobile bottom bar */
  bottom?: boolean;
  /** extra path prefixes that should highlight this item */
  also?: string[];
  badgeKey?: string;
};

function isActive(path: string, item: NavItem) {
  const roots = [item.href, ...(item.also || [])];
  return roots.some((r) => path === r || path.startsWith(r + '/'));
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="lightning-bolt" size={22} />
      </View>
      {!compact ? (
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', letterSpacing: 0.3 }}>
          Fit<Text style={{ color: colors.primary }}>Track</Text>
        </Text>
      ) : null}
    </View>
  );
}

export function Shell({ items, badges = {}, children, roleLabel }: { items: NavItem[]; badges?: Record<string, number>; children: React.ReactNode; roleLabel: string }) {
  const { isMobile, isDesktop } = useBreakpoint();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const { user, profile, logout } = useAuth();
  const { confirm } = useDialog();
  const [more, setMore] = useState(false);

  const doLogout = async () => {
    if (await confirm({ title: 'Log out?', message: 'You will need to sign in again.', confirmText: 'Log out', destructive: true })) {
      await logout();
    }
  };

  const go = (href: string) => {
    setMore(false);
    router.navigate(href as any);
  };

  if (isMobile) {
    const bottom = items.filter((i) => i.bottom);
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1 }}>{children}</View>
        <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 6), paddingTop: 6 }}>
          {bottom.map((it) => {
            const on = isActive(path, it);
            const b = it.badgeKey ? badges[it.badgeKey] : 0;
            return (
              <Pressable key={it.href} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => go(it.href)} style={{ flex: 1, alignItems: 'center', paddingVertical: 4, minHeight: 48 }}>
                <View>
                  <Icon name={it.icon} size={25} color={on ? colors.primary : colors.textDim} />
                  {b ? (
                    <View style={{ position: 'absolute', top: -3, right: -8, backgroundColor: colors.primary, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{b > 9 ? '9+' : b}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ color: on ? colors.text : colors.textDim, fontSize: 11, marginTop: 2, fontWeight: on ? '700' : '500' }}>{it.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Sheet visible={more} onClose={() => setMore(false)} title="More">
          {items.map((it) => (
            <Pressable key={it.href} onPress={() => go(it.href)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 }}>
              <Icon name={it.icon} color={colors.primary} />
              <AppText>{it.label}</AppText>
            </Pressable>
          ))}
        </Sheet>
      </View>
    );
  }

  const side = items.filter((i) => i.side);
  const width = isDesktop ? 244 : 84;
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg }}>
      <View style={{ width, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border, paddingTop: Math.max(insets.top, 16) + 4, paddingBottom: 16 }}>
        <View style={{ paddingHorizontal: isDesktop ? 20 : 0, alignItems: isDesktop ? 'flex-start' : 'center', marginBottom: 20 }}>
          <Logo compact={!isDesktop} />
          {isDesktop ? (
            <AppText variant="label" color={colors.primary} style={{ marginTop: 8 }}>
              {roleLabel}
            </AppText>
          ) : null}
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: isDesktop ? 12 : 8, gap: 4 }}>
          {side.map((it) => {
            const on = isActive(path, it);
            const b = it.badgeKey ? badges[it.badgeKey] : 0;
            return (
              <Pressable
                key={it.href}
                accessibilityRole="link"
                onPress={() => go(it.href)}
                style={({ pressed, hovered }: any) => [
                  {
                    flexDirection: isDesktop ? 'row' : 'column',
                    alignItems: 'center',
                    gap: isDesktop ? 12 : 3,
                    paddingVertical: isDesktop ? 11 : 9,
                    paddingHorizontal: isDesktop ? 12 : 4,
                    borderRadius: radius.md,
                    backgroundColor: on ? colors.primary + '26' : hovered ? colors.surfaceAlt : 'transparent',
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Icon name={it.icon} size={22} color={on ? colors.primary : colors.textMuted} />
                <Text style={{ color: on ? colors.text : colors.textMuted, fontWeight: on ? '700' : '500', fontSize: isDesktop ? 14.5 : 10.5, flex: isDesktop ? 1 : undefined }} numberOfLines={1}>
                  {it.label}
                </Text>
                {b ? (
                  <View style={{ backgroundColor: colors.primary, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, position: isDesktop ? 'relative' : 'absolute', top: isDesktop ? undefined : 2, right: isDesktop ? undefined : 10 }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{b > 9 ? '9+' : b}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={{ paddingHorizontal: isDesktop ? 14 : 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, alignItems: isDesktop ? 'stretch' : 'center', gap: 10 }}>
          {isDesktop ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar name={profile?.name || user?.displayName || user?.email || ''} uri={profile?.photoData} size={36} />
              <View style={{ flex: 1 }}>
                <AppText variant="h3" numberOfLines={1}>
                  {profile?.name || user?.displayName || 'Admin'}
                </AppText>
                <AppText variant="caption" muted numberOfLines={1}>
                  {user?.email}
                </AppText>
              </View>
            </View>
          ) : null}
          {isDesktop ? <Button title="Log out" icon="logout" variant="secondary" size="sm" onPress={doLogout} /> : <Pressable onPress={doLogout} accessibilityLabel="Log out" style={{ padding: 8 }}><Icon name="logout" color={colors.textMuted} /></Pressable>}
        </View>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
