import React, { useState } from 'react';
import { View } from 'react-native';
import { Link, router } from 'expo-router';
import { AuthFrame } from '../../components/layout/AuthFrame';
import { AppText, Banner, Button, Input } from '../../components/ui';
import { friendlyAuthError, useAuth } from '../../lib/auth';
import { colors } from '../../lib/theme';
import { isEmail } from '../../lib/format';

export function passwordProblem(p: string): string | null {
  if (p.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Include at least one letter and one number.';
  return null;
}

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const submit = async () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Please enter your name.';
    if (!isEmail(email)) e.email = 'Enter a valid email address.';
    const pp = passwordProblem(password);
    if (pp) e.password = pp;
    if (confirm !== password) e.confirm = 'Passwords do not match.';
    setErrs(e);
    setError(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await register(name, email, password);
      router.replace('/');
    } catch (err: any) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame>
      <AppText variant="h1">Create your account</AppText>
      <AppText muted style={{ marginTop: 4, marginBottom: 20 }}>
        Join as a gym member. We'll email you a link to verify your address.
      </AppText>
      {error ? <Banner tone="bad" text={error} /> : null}
      <Input label="Full name" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Your name" error={errs.name} />
      <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" error={errs.email} />
      <Input label="Password" value={password} onChangeText={setPassword} secure placeholder="Min. 8 characters, letters + numbers" error={errs.password} />
      <Input label="Confirm password" value={confirm} onChangeText={setConfirm} secure placeholder="Repeat password" error={errs.confirm} onSubmitEditing={submit} />
      <Button title="Create account" onPress={submit} loading={busy} full style={{ marginTop: 6 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 6 }}>
        <AppText muted>Already have an account?</AppText>
        <Link href="/login">
          <AppText color={colors.primary} style={{ fontWeight: '700' }}>
            Log in
          </AppText>
        </Link>
      </View>
    </AuthFrame>
  );
}
