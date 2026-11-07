import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, MAX_CONTENT_WIDTH, radius, spacing } from '../../lib/theme';
import { useBreakpoint } from '../../lib/useBreakpoint';

export type Tone = 'good' | 'warn' | 'bad' | 'neutral' | 'info';
export const toneColor = (t: Tone) =>
  t === 'good' ? colors.success : t === 'warn' ? colors.warning : t === 'bad' ? colors.danger : t === 'info' ? colors.info : colors.textMuted;

// ---------------------------------------------------------------- Icon
export function Icon({ name, size = 22, color = colors.text, style }: { name: string; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  return <MaterialCommunityIcons name={name as any} size={size} color={color} style={style} />;
}

// ---------------------------------------------------------------- Text
type Variant = 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'label' | 'big';
const variants: Record<Variant, TextStyle> = {
  big: { fontSize: 40, fontWeight: '800', letterSpacing: -0.5 },
  h1: { fontSize: 28, fontWeight: '800', letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '700' },
  h3: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  caption: { fontSize: 12.5, fontWeight: '400', lineHeight: 17 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
};
export function AppText({
  variant = 'body',
  color = colors.text,
  muted,
  style,
  children,
  numberOfLines,
  center,
}: {
  variant?: Variant;
  color?: string;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
  children?: React.ReactNode;
  numberOfLines?: number;
  center?: boolean;
}) {
  return (
    <Text numberOfLines={numberOfLines} style={[variants[variant], { color: muted ? colors.textMuted : color }, center && { textAlign: 'center' }, style]}>
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------- Card
export function Card({
  children,
  style,
  onPress,
  accent,
  padded = true,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accent?: string;
  padded?: boolean;
}) {
  const base: StyleProp<ViewStyle> = [
    styles.card,
    padded && { padding: spacing.lg },
    accent ? { borderLeftWidth: 3, borderLeftColor: accent } : null,
    style,
  ];
  if (onPress)
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  return <View style={base}>{children}</View>;
}

// ---------------------------------------------------------------- Button
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  disabled,
  full,
  style,
}: {
  title: string;
  onPress?: () => unknown;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.primaryDark : variant === 'secondary' ? colors.surfaceAlt : 'transparent';
  const border = variant === 'secondary' ? colors.border : variant === 'ghost' ? colors.border : 'transparent';
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={off}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: border, paddingVertical: size === 'sm' ? 8 : 13, paddingHorizontal: size === 'sm' ? 12 : 18 },
        full && { alignSelf: 'stretch' },
        off && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} size="small" />
      ) : (
        <>
          {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 19} style={{ marginRight: 7 }} /> : null}
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: size === 'sm' ? 13 : 15 }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, onPress, color = colors.text, size = 22, label }: { icon: string; onPress?: () => void; color?: string; size?: number; label?: string }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}>
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}

// ---------------------------------------------------------------- Inputs
export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
  error,
  unit,
  multiline,
  autoCapitalize = 'none',
  hint,
  editable = true,
  onSubmitEditing,
  style,
}: {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  error?: string | null;
  unit?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  hint?: string;
  editable?: boolean;
  onSubmitEditing?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [focus, setFocus] = useState(false);
  const [show, setShow] = useState(false);
  return (
    <View style={[{ marginBottom: spacing.md }, style]}>
      {label ? (
        <AppText variant="caption" muted style={{ marginBottom: 6, fontWeight: '600' }}>
          {label}
        </AppText>
      ) : null}
      <View style={[styles.inputWrap, focus && { borderColor: colors.primary }, error ? { borderColor: colors.danger } : null, !editable && { opacity: 0.6 }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textDim}
          secureTextEntry={secure && !show}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          multiline={multiline}
          editable={editable}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          onSubmitEditing={onSubmitEditing}
          style={[styles.input, multiline && { minHeight: 80, textAlignVertical: 'top' }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]}
        />
        {unit ? <Text style={{ color: colors.textDim, marginLeft: 6 }}>{unit}</Text> : null}
        {secure ? (
          <Pressable onPress={() => setShow((s) => !s)} hitSlop={8} accessibilityLabel={show ? 'Hide password' : 'Show password'}>
            <Icon name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" color={colors.danger} style={{ marginTop: 4 }}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" muted style={{ marginTop: 4 }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T | '';
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? (
        <AppText variant="caption" muted style={{ marginBottom: 6, fontWeight: '600' }}>
          {label}
        </AppText>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(o.value)}
              style={[styles.chip, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            >
              <Text style={{ color: colors.text, fontWeight: on ? '700' : '500', fontSize: 13.5 }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <AppText variant="h3">{label}</AppText>
        {hint ? (
          <AppText variant="caption" muted>
            {hint}
          </AppText>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.primaryDark }} thumbColor={value ? colors.primary : '#888'} />
    </View>
  );
}

// ---------------------------------------------------------------- Small pieces
export function ProgressBar({ value, color = colors.primary, height = 8 }: { value: number; color?: string; height?: number }) {
  const v = Math.max(0, Math.min(1, isFinite(value) ? value : 0));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
      <View style={{ width: `${v * 100}%`, height: '100%', backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

export function Badge({ text, tone = 'neutral', color }: { text: string; tone?: Tone; color?: string }) {
  const c = color || toneColor(tone);
  return (
    <View style={{ backgroundColor: c + '26', borderColor: c + '66', borderWidth: 1, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' }}>
      <Text style={{ color: c, fontSize: 11.5, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

export function Loading({ text }: { text?: string }) {
  return (
    <View style={{ padding: 40, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.primary} size="large" />
      {text ? (
        <AppText muted style={{ marginTop: 10 }}>
          {text}
        </AppText>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon = 'inbox-outline', title, text, action }: { icon?: string; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', padding: spacing.xl }}>
      <Icon name={icon} size={40} color={colors.textDim} />
      <AppText variant="h3" style={{ marginTop: 10 }}>
        {title}
      </AppText>
      {text ? (
        <AppText muted center style={{ marginTop: 4 }}>
          {text}
        </AppText>
      ) : null}
      {action ? <View style={{ marginTop: 14 }}>{action}</View> : null}
    </View>
  );
}

export function Banner({ text, tone = 'warn', action }: { text: string; tone?: Tone; action?: React.ReactNode }) {
  const c = toneColor(tone);
  return (
    <View style={{ backgroundColor: c + '1F', borderColor: c + '66', borderWidth: 1, borderRadius: radius.md, padding: 12, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Icon name={tone === 'good' ? 'check-circle-outline' : tone === 'bad' ? 'alert-circle-outline' : 'information-outline'} color={c} />
      <Text style={{ color: colors.text, flex: 1, fontSize: 13.5, lineHeight: 19 }}>{text}</Text>
      {action}
    </View>
  );
}

export function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm }}>
      <AppText variant="h2">{title}</AppText>
      {right}
    </View>
  );
}

export function Row({ children, style, gap = 10 }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function KeyValue({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: 12 }}>
      <AppText muted style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText style={{ fontWeight: '600', flexShrink: 1, textAlign: 'right' }} color={color}>
        {value}
      </AppText>
    </View>
  );
}

export function StatCard({ icon, label, value, unit, sub, color = colors.primary }: { icon: string; label: string; value: string; unit?: string; sub?: string; color?: string }) {
  return (
    <Card style={{ flex: 1, minWidth: 140 }}>
      <Row>
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: color + '26', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={19} color={color} />
        </View>
        <AppText variant="caption" muted style={{ flex: 1 }} numberOfLines={1}>
          {label}
        </AppText>
      </Row>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 10, gap: 4 }}>
        <AppText style={{ fontSize: 26, fontWeight: '800' }}>{value}</AppText>
        {unit ? (
          <AppText variant="caption" muted>
            {unit}
          </AppText>
        ) : null}
      </View>
      {sub ? (
        <AppText variant="caption" muted style={{ marginTop: 2 }}>
          {sub}
        </AppText>
      ) : null}
    </Card>
  );
}

export function Avatar({ name, uri, size = 44 }: { name?: string; uri?: string | null; size?: number }) {
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceAlt }} />;
  const initials = (name || '?')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primaryDark, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.text, fontWeight: '800', fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- Grid (responsive columns)
export function Grid({ children, cols, gap = 12 }: { children: React.ReactNode; cols?: { mobile?: number; tablet?: number; desktop?: number }; gap?: number }) {
  const { bp } = useBreakpoint();
  const n = (cols && cols[bp]) || (bp === 'desktop' ? 3 : bp === 'tablet' ? 2 : 1);
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -gap / 2 }}>
      {items.map((c, i) => (
        <View key={i} style={{ width: `${100 / n}%`, padding: gap / 2 }}>
          {c}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- Screen
export function Screen({
  title,
  subtitle,
  right,
  back,
  children,
  scroll = true,
  keyboard,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  back?: boolean | string;
  children?: React.ReactNode;
  scroll?: boolean;
  keyboard?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { isDesktop } = useBreakpoint();
  const header = title ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg, gap: 8 }}>
      {back ? <IconButton icon="arrow-left" label="Back" onPress={() => (typeof back === 'string' ? router.navigate(back as any) : router.back())} /> : null}
      <View style={{ flex: 1 }}>
        <AppText variant="h1">{title}</AppText>
        {subtitle ? (
          <AppText muted variant="caption" style={{ marginTop: 2 }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  ) : null;
  const inner = (
    <View style={{ width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', paddingHorizontal: isDesktop ? spacing.xxl : spacing.lg, paddingTop: Math.max(insets.top, 12) + (isDesktop ? 12 : 4), paddingBottom: spacing.xxl }}>
      {header}
      {children}
    </View>
  );
  const body = scroll ? (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      {inner}
    </ScrollView>
  ) : (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>{inner}</View>
  );
  if (keyboard && Platform.OS !== 'web')
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
      </KeyboardAvoidingView>
    );
  return body;
}

// ---------------------------------------------------------------- Sheet (modal)
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children?: React.ReactNode }) {
  const { isMobile } = useBreakpoint();
  return (
    <Modal visible={visible} transparent animationType={isMobile ? 'slide' : 'fade'} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={[
            styles.sheet,
            isMobile
              ? { width: '100%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, position: 'absolute', bottom: 0, maxHeight: '88%' }
              : { width: 520, maxWidth: '92%', maxHeight: '88%' },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <AppText variant="h2">{title}</AppText>
            <IconButton icon="close" onPress={onClose} label="Close" />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------- Dialogs & toasts
type ConfirmOpts = { title: string; message?: string; confirmText?: string; destructive?: boolean };
type DialogCtx = {
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  toast: (msg: string, tone?: Tone) => void;
};
const DialogContext = createContext<DialogCtx | null>(null);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dlg, setDlg] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const [toastState, setToast] = useState<{ msg: string; tone: Tone } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setDlg({ ...o, resolve })), []);
  const toast = useCallback((msg: string, tone: Tone = 'neutral') => {
    setToast({ msg, tone });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const value = useMemo(() => ({ confirm, toast }), [confirm, toast]);
  const close = (v: boolean) => {
    dlg?.resolve(v);
    setDlg(null);
  };
  return (
    <DialogContext.Provider value={value}>
      {children}
      <Modal visible={!!dlg} transparent animationType="fade" onRequestClose={() => close(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { width: 420, maxWidth: '90%' }]}>
            <AppText variant="h2">{dlg?.title}</AppText>
            {dlg?.message ? (
              <AppText muted style={{ marginTop: 8 }}>
                {dlg.message}
              </AppText>
            ) : null}
            <Row style={{ justifyContent: 'flex-end', marginTop: spacing.xl }}>
              <Button title="Cancel" variant="ghost" size="sm" onPress={() => close(false)} />
              <Button title={dlg?.confirmText || 'Confirm'} variant={dlg?.destructive ? 'danger' : 'primary'} size="sm" onPress={() => close(true)} />
            </Row>
          </View>
        </View>
      </Modal>
      {toastState ? (
        <View pointerEvents="none" style={styles.toastWrap}>
          <View style={[styles.toast, { borderColor: toneColor(toastState.tone) }]}>
            <Icon name={toastState.tone === 'good' ? 'check-circle' : toastState.tone === 'bad' ? 'alert-circle' : 'information'} color={toneColor(toastState.tone)} size={18} />
            <Text style={{ color: colors.text, marginLeft: 8, flexShrink: 1 }}>{toastState.msg}</Text>
          </View>
        </View>
      ) : null}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogCtx {
  const c = useContext(DialogContext);
  if (!c) throw new Error('useDialog must be used inside DialogProvider');
  return c;
}

/** Runs an async action with a busy flag and error toast. */
export function useBusy() {
  const { toast } = useDialog();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, opts?: { success?: string }): Promise<T | undefined> => {
      setBusy(true);
      try {
        const r = await fn();
        if (opts?.success) toast(opts.success, 'good');
        return r;
      } catch (e: any) {
        toast(e?.message || 'Something went wrong', 'bad');
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );
  return { busy, run };
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1 },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14 },
  input: { flex: 1, color: colors.text, fontSize: 15.5, paddingVertical: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.border },
  toastWrap: { position: 'absolute', left: 0, right: 0, bottom: 90, alignItems: 'center', paddingHorizontal: 16 },
  toast: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, maxWidth: 520 },
});
