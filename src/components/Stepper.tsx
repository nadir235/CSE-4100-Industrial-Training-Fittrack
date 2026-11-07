import React from 'react';
import { Pressable, View } from 'react-native';
import { AppText, Icon } from './ui';
import { colors, radius } from '../lib/theme';

export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  const btn = (icon: string, delta: number) => (
    <Pressable
      accessibilityLabel={`${delta > 0 ? 'Increase' : 'Decrease'} ${label}`}
      onPress={() => onChange(Math.max(min, Math.min(max, value + delta)))}
      style={({ pressed }) => ({ width: 34, height: 34, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
    >
      <Icon name={icon} size={18} />
    </Pressable>
  );
  return (
    <View style={{ alignItems: 'center', minWidth: 96 }}>
      <AppText variant="caption" muted style={{ marginBottom: 4 }}>
        {label}
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {btn('minus', -step)}
        <AppText variant="h3" style={{ minWidth: 36, textAlign: 'center' }}>
          {value}
          {unit ? <AppText variant="caption" muted>{unit}</AppText> : null}
        </AppText>
        {btn('plus', step)}
      </View>
    </View>
  );
}
