import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';

export default function Index() {
  const { user, role } = useAuth();
  if (!user) return <Redirect href="/login" />;
  return <Redirect href={role === 'admin' ? '/dashboard' : '/home'} />;
}
