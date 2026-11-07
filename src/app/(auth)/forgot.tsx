import React, { useState } from 'react';
import { View } from 'react-native';
import { Link } from 'expo-router';
import { AuthFrame } from '../../components/layout/AuthFrame';
import { AppText, Banner, Button, Input } from '../../components/ui';
import { friendlyAuthError, useAuth } from '../../lib/auth';
import { colors } from '../../lib/theme';
import { isEmail } from '../../lib/format';

export default function Forgot() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!isEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err: any) {
      // Don't reveal whether an account exists
      if (err?.code === 'auth/user-not-found') setSent(true);
      else setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame>
      <AppText variant="h1">Reset your password</AppText>
      <AppText muted style={{ marginTop: 4, marginBottom: 20 }}>
        Enter your account email and we'll send you a secure link to choose a new password.
      </AppText>
      {sent ? <Banner tone="good" text="If an account exists for that email, a reset link is on its way. Check your inbox and spam folder." /> : null}
      {error ? <Banner tone="bad" text={error} /> : null}
      <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" onSubmitEditing={submit} />
      <Button title={sent ? 'Send again' : 'Send reset link'} onPress={submit} loading={busy} full />
      <View style={{ alignItems: 'center', marginTop: 20 }}>
        <Link href="/login">
          <AppText color={colors.primary} style={{ fontWeight: '700' }}>
            Back to login
          </AppText>
        </Link>
      </View>
    </AuthFrame>
  );
}
