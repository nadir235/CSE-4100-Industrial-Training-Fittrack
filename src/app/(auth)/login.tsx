import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Link, router } from 'expo-router';
import { AuthFrame } from '../../components/layout/AuthFrame';
import { AppText, Banner, Button, Card, Icon, Input } from '../../components/ui';
import { friendlyAuthError, useAuth } from '../../lib/auth';
import { colors, radius } from '../../lib/theme';
import { isEmail } from '../../lib/format';

export default function Login() {
  const { login } = useAuth();
  const [mode, setMode] = useState<'member' | 'admin'>('member');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errs, setErrs] = useState<{ email?: string; password?: string }>({});

  const submit = async () => {
    const e: typeof errs = {};
    if (!isEmail(email)) e.email = 'Enter a valid email address.';
    if (!password) e.password = 'Enter your password.';
    setErrs(e);
    setError(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await login(email, password, mode);
      router.replace('/');
    } catch (err: any) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame>
      <AppText variant="h1">Welcome back</AppText>
      <AppText muted style={{ marginTop: 4, marginBottom: 20 }}>
        Log in to continue your fitness journey.
      </AppText>

      <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: colors.border, marginBottom: 20 }}>
        {(['member', 'admin'] as const).map((m) => {
          const on = mode === m;
          return (
            <Pressable
              key={m}
              onPress={() => {
                setMode(m);
                setError(null);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: radius.sm, backgroundColor: on ? colors.primary : 'transparent' }}
            >
              <Icon name={m === 'member' ? 'account' : 'shield-account'} size={18} />
              <AppText style={{ fontWeight: '700' }}>{m === 'member' ? 'Login as Member' : 'Login as Admin'}</AppText>
            </Pressable>
          );
        })}
      </View>

      {error ? <Banner tone="bad" text={error} /> : null}

      <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" error={errs.email} />
      <Input label="Password" value={password} onChangeText={setPassword} secure placeholder="Your password" error={errs.password} onSubmitEditing={submit} />

      <View style={{ alignItems: 'flex-end', marginTop: -4, marginBottom: 16 }}>
        <Link href="/forgot">
          <AppText color={colors.primary} style={{ fontWeight: '600' }}>
            Forgot password?
          </AppText>
        </Link>
      </View>

      <Button title={mode === 'admin' ? 'Log in as Admin' : 'Log in'} onPress={submit} loading={busy} full />

      {mode === 'member' ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 6 }}>
          <AppText muted>New to FitTrack?</AppText>
          <Link href="/register">
            <AppText color={colors.primary} style={{ fontWeight: '700' }}>
              Create an account
            </AppText>
          </Link>
        </View>
      ) : (
        <Card style={{ marginTop: 20 }}>
          <AppText variant="caption" muted>
            Administrator accounts are created by the gym owner using the secure admin setup script — they can't be registered here.
          </AppText>
        </Card>
      )}
    </AuthFrame>
  );
}
