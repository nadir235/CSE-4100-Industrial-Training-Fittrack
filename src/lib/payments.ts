import type { Tone } from '../components/ui';
import type { PaymentStatus } from './types';

export const METHODS = [
  { value: 'bkash', label: 'bKash' },
  { value: 'nagad', label: 'Nagad' },
  { value: 'sslcommerz', label: 'SSLCommerz' },
  { value: 'card', label: 'Debit / Credit card' },
];

export const statusTone = (s: PaymentStatus): Tone => (s === 'successful' ? 'good' : s === 'pending' ? 'warn' : s === 'refunded' ? 'info' : 'bad');
