import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Icon } from './ui';
import { colors, radius } from '../lib/theme';

export type PopupItem = {
  title: string;
  body?: string;
  kind?: string;
  /** where tapping the popup goes; defaults to the notifications inbox */
  href?: string;
  /** called when the popup is tapped (before navigation) */
  onOpen?: () => void;
};

type Ctx = { show: (item: PopupItem) => void };
const PopupContext = createContext<Ctx | null>(null);

const KIND_ICON: Record<string, string> = {
  announcement: 'bullhorn-outline',
  payment: 'credit-card-check-outline',
  membership: 'card-account-details-outline',
  workout: 'dumbbell',
  recommendation: 'lightbulb-on-outline',
  water: 'water',
  fasting: 'timer-sand',
  success: 'check-circle-outline',
};
const KIND_COLOR: Record<string, string> = {
  payment: colors.success,
  success: colors.success,
  water: '#4DA3FF',
  fasting: colors.warning,
};

const VISIBLE_MS = 6500;

type Queued = PopupItem & { key: number };

/** Mount once near the root. Any screen can call usePopup().show({...}). */
export function PopupProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<Queued | null>(null);
  const queue = useRef<Queued[]>([]);
  const seq = useRef(0);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);

  const native = Platform.OS !== 'web';

  const next = useCallback(() => {
    if (busy.current) return;
    const item = queue.current.shift();
    if (!item) return;
    busy.current = true;
    setCurrent(item);
    if (native) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.spring(anim, { toValue: 1, useNativeDriver: native, speed: 14, bounciness: 6 }).start();
    timer.current = setTimeout(() => hide(), VISIBLE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anim, native]);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: native }).start(() => {
      setCurrent(null);
      busy.current = false;
      next();
    });
  }, [anim, native, next]);

  const show = useCallback(
    (item: PopupItem) => {
      // avoid stacking identical popups
      if (queue.current.some((q) => q.title === item.title && q.body === item.body)) return;
      queue.current.push({ ...item, key: ++seq.current });
      next();
    },
    [next],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo(() => ({ show }), [show]);
  const kind = current?.kind || '';
  const accent = KIND_COLOR[kind] || colors.primary;

  return (
    <PopupContext.Provider value={value}>
      {children}
      {current ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999, elevation: 9999, alignItems: 'center', paddingTop: Math.max(insets.top, 10) + 6, paddingHorizontal: 12 }}>
          <Animated.View
            style={{
              width: '100%',
              maxWidth: 480,
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-90, 0] }) }],
            }}
          >
            <Pressable
              accessibilityRole="alert"
              accessibilityLabel={`${current.title}. ${current.body || ''}`}
              onPress={() => {
                current.onOpen?.();
                hide();
                router.navigate((current.href || '/notifications') as any);
              }}
              style={{
                flexDirection: 'row',
                gap: 12,
                backgroundColor: colors.surfaceAlt,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                borderLeftWidth: 4,
                borderLeftColor: accent,
                padding: 14,
                shadowColor: '#000',
                shadowOpacity: 0.5,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 6 },
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: accent + '26', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={KIND_ICON[kind] || 'bell-ring-outline'} size={20} color={accent} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="h3" numberOfLines={1}>
                  {current.title}
                </AppText>
                {current.body ? (
                  <AppText variant="caption" muted numberOfLines={3} style={{ marginTop: 2 }}>
                    {current.body}
                  </AppText>
                ) : null}
                <Text style={{ color: accent, fontSize: 12, fontWeight: '700', marginTop: 6 }}>Tap to view</Text>
              </View>
              <Pressable accessibilityLabel="Dismiss notification" hitSlop={10} onPress={hide} style={{ alignSelf: 'flex-start' }}>
                <Icon name="close" size={18} color={colors.textDim} />
              </Pressable>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </PopupContext.Provider>
  );
}

export function usePopup(): Ctx {
  const c = useContext(PopupContext);
  if (!c) throw new Error('usePopup must be used inside PopupProvider');
  return c;
}
