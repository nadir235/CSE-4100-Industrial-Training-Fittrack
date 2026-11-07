import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { AppText, Avatar, Banner, Button, Card, Chips, Input, Row, Screen, SectionTitle, useBusy, useDialog } from '../../components/ui';
import { LEVELS } from '../../data/workouts';
import { useAuth } from '../../lib/auth';
import { useMemberActions } from '../../lib/member';
import { clean } from '../../lib/member';
import type { FitnessLevel, Sex } from '../../lib/types';

const GOALS = [
  { value: 'lose-weight', label: 'Lose weight' },
  { value: 'build-muscle', label: 'Build muscle' },
  { value: 'endurance', label: 'Improve endurance' },
  { value: 'stay-fit', label: 'Stay fit & healthy' },
];

export default function Profile() {
  const { profile, user, resetPassword, emailVerified } = useAuth();
  const actions = useMemberActions();
  const { toast } = useDialog();
  const { busy, run } = useBusy();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex | ''>('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goal, setGoal] = useState('');
  const [level, setLevel] = useState<FitnessLevel>('beginner');
  const [minutes, setMinutes] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (profile && !loaded) {
      setName(profile.name || '');
      setPhone(profile.phone || '');
      setAge(profile.age ? String(profile.age) : '');
      setSex(profile.sex || '');
      setHeight(profile.heightCm ? String(profile.heightCm) : '');
      setWeight(profile.weightKg ? String(profile.weightKg) : '');
      setGoal(profile.goal || '');
      setLevel(profile.fitnessLevel || 'beginner');
      setMinutes(profile.availableMinutes ? String(profile.availableMinutes) : '');
      setLoaded(true);
    }
  }, [profile, loaded]);

  const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
  const save = async () => {
    if (name.trim().length < 2) return toast('Please enter your name.', 'warn');
    const a = num(age), h = num(height), w = num(weight), m = num(minutes);
    if (a !== undefined && (!isFinite(a) || a < 10 || a > 100)) return toast('Age must be 10–100.', 'warn');
    if (h !== undefined && (!isFinite(h) || h < 100 || h > 250)) return toast('Height must be 100–250 cm.', 'warn');
    if (w !== undefined && (!isFinite(w) || w < 25 || w > 300)) return toast('Weight must be 25–300 kg.', 'warn');
    if (m !== undefined && (!isFinite(m) || m < 5 || m > 300)) return toast('Available time must be 5–300 minutes.', 'warn');
    if (phone && !/^[+\d][\d\s-]{6,18}$/.test(phone)) return toast('Phone number looks invalid.', 'warn');
    await run(() => actions.updateProfile(clean({ name: name.trim(), phone: phone.trim() || undefined, age: a, sex: sex || undefined, heightCm: h, weightKg: w, goal: goal || undefined, fitnessLevel: level, availableMinutes: m })), { success: 'Profile saved' });
  };

  const pickPhoto = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
      if (res.canceled || !res.assets[0]) return;
      // Resize to a small square JPEG and store it as a data URL on the profile (no Storage bucket needed).
      const out = await ImageManipulator.manipulateAsync(res.assets[0].uri, [{ resize: { width: 256, height: 256 } }], { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      if (!out.base64) throw new Error('Could not process the image.');
      await run(() => actions.updateProfile({ photoData: `data:image/jpeg;base64,${out.base64}` }), { success: 'Photo updated' });
    } catch (e: any) {
      toast(e?.message || 'Could not pick a photo', 'bad');
    }
  };

  return (
    <Screen title="Profile" subtitle="Your personal information" keyboard>
      <Card>
        <Row gap={16}>
          <Avatar name={profile?.name} uri={profile?.photoData} size={72} />
          <View style={{ flex: 1 }}>
            <AppText variant="h3">{profile?.name}</AppText>
            <AppText muted variant="caption">{user?.email}</AppText>
            <Button title="Change photo" size="sm" variant="secondary" icon="camera" style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={pickPhoto} />
          </View>
        </Row>
      </Card>
      {!emailVerified ? <View style={{ marginTop: 12 }}><Banner text="Your email is not verified yet. Check your inbox or resend from the Home screen." /></View> : null}

      <SectionTitle title="About you" />
      <Card>
        <Input label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Input label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+8801XXXXXXXXX" />
        <Row style={{ flexWrap: 'wrap', alignItems: 'flex-start' }} gap={12}>
          <Input style={{ flex: 1, minWidth: 120 }} label="Age" value={age} onChangeText={setAge} keyboardType="numeric" unit="yrs" />
          <Input style={{ flex: 1, minWidth: 120 }} label="Height" value={height} onChangeText={setHeight} keyboardType="decimal-pad" unit="cm" />
          <Input style={{ flex: 1, minWidth: 120 }} label="Weight" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" unit="kg" />
        </Row>
        <Chips label="Sex (used by health formulas)" value={sex} onChange={setSex} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
      </Card>

      <SectionTitle title="Training" />
      <Card>
        <Chips label="Fitness level" value={level} onChange={setLevel} options={LEVELS.map((l) => ({ value: l.id, label: l.label }))} />
        <Chips label="Main goal" value={goal} onChange={setGoal} options={GOALS} />
        <Input label="Time available per workout" value={minutes} onChangeText={setMinutes} keyboardType="numeric" unit="min" hint="The AI coach uses this to suggest realistic plans." />
      </Card>

      <Button title="Save changes" icon="content-save" full onPress={save} loading={busy} style={{ marginTop: 16 }} />

      <SectionTitle title="Security" />
      <Card>
        <AppText muted style={{ marginBottom: 10 }}>We'll email you a secure link to change your password.</AppText>
        <Button title="Send password reset email" variant="secondary" icon="lock-reset" onPress={() => run(async () => { if (user?.email) await resetPassword(user.email); }, { success: 'Reset email sent' })} />
      </Card>
      {Platform.OS === 'web' ? null : null}
    </Screen>
  );
}
