import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { colors } from '../lib/theme';
import { AppText } from './ui';
import type { LatLng } from '../lib/geo';

/** Lightweight route preview drawn with SVG (no map SDK / API key required). */
export function RouteMap({ points, height = 180 }: { points: LatLng[]; height?: number }) {
  if (points.length < 2)
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 12 }}>
        <AppText muted variant="caption">Route appears once you start moving</AppText>
      </View>
    );
  const W = 300;
  const H = 180;
  const pad = 14;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const midLat = (minLat + maxLat) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const spanX = Math.max((maxLng - minLng) * kx, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);
  const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);
  const ox = (W - spanX * scale) / 2;
  const oy = (H - spanY * scale) / 2;
  const toXY = (p: LatLng) => ({ x: ox + (p.lng - minLng) * kx * scale, y: H - oy - (p.lat - minLat) * scale });
  const xy = points.map(toXY);
  const start = xy[0];
  const end = xy[xy.length - 1];
  return (
    <View style={{ height, backgroundColor: colors.surfaceAlt, borderRadius: 12, overflow: 'hidden' }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <Polyline points={xy.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} stroke={colors.primary} strokeWidth={3.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={start.x} cy={start.y} r={5} fill={colors.success} />
        <Circle cx={end.x} cy={end.y} r={5} fill={colors.text} stroke={colors.primary} strokeWidth={2} />
      </Svg>
    </View>
  );
}
