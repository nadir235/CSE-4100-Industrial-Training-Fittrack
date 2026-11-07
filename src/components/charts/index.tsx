import React, { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { colors } from '../../lib/theme';
import { AppText } from '../ui';

export type Point = { label: string; value: number };

function useWidth(initial = 320) {
  const [w, setW] = useState(initial);
  const onLayout = (e: LayoutChangeEvent) => {
    const nw = Math.floor(e.nativeEvent.layout.width);
    if (nw > 0 && nw !== w) setW(nw);
  };
  return [w, onLayout] as const;
}

const niceMax = (m: number) => {
  if (m <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(m)));
  const f = m / p;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return n * p;
};

export function BarChart({
  data,
  height = 170,
  color = colors.primary,
  unit = '',
  emptyText = 'No data yet',
  format = (v: number) => String(Math.round(v * 10) / 10),
}: {
  data: Point[];
  height?: number;
  color?: string;
  unit?: string;
  emptyText?: string;
  format?: (v: number) => string;
}) {
  const [w, onLayout] = useWidth();
  const total = data.reduce((s, d) => s + d.value, 0);
  const padL = 34;
  const padB = 22;
  const padT = 16;
  const plotH = height - padB - padT;
  const plotW = Math.max(10, w - padL - 4);
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const bw = Math.max(6, Math.min(34, (plotW / Math.max(data.length, 1)) * 0.6));
  const step = plotW / Math.max(data.length, 1);
  return (
    <View onLayout={onLayout} style={{ width: '100%' }}>
      {total === 0 ? (
        <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
          <AppText muted variant="caption">
            {emptyText}
          </AppText>
        </View>
      ) : (
        <Svg width={w} height={height}>
          {[0, 0.5, 1].map((f) => {
            const y = padT + plotH * (1 - f);
            return (
              <G key={f}>
                <Line x1={padL} x2={w} y1={y} y2={y} stroke={colors.border} strokeWidth={1} />
                <SvgText x={padL - 6} y={y + 4} fontSize={10} fill={colors.textDim} textAnchor="end">
                  {format(max * f)}
                </SvgText>
              </G>
            );
          })}
          {data.map((d, i) => {
            const h = (d.value / max) * plotH;
            const x = padL + step * i + (step - bw) / 2;
            return (
              <G key={i}>
                <Rect x={x} y={padT + plotH - h} width={bw} height={Math.max(h, d.value > 0 ? 2 : 0)} rx={4} fill={color} opacity={d.value > 0 ? 1 : 0.2} />
                {data.length <= 8 && d.value > 0 ? (
                  <SvgText x={x + bw / 2} y={padT + plotH - h - 4} fontSize={10} fill={colors.textMuted} textAnchor="middle">
                    {format(d.value)}
                  </SvgText>
                ) : null}
                {data.length <= 12 || i % Math.ceil(data.length / 8) === 0 ? (
                  <SvgText x={x + bw / 2} y={height - 6} fontSize={10} fill={colors.textDim} textAnchor="middle">
                    {d.label}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
        </Svg>
      )}
      {unit && total > 0 ? (
        <AppText variant="caption" muted style={{ textAlign: 'right' }}>
          {unit}
        </AppText>
      ) : null}
    </View>
  );
}

export function LineChart({
  data,
  height = 170,
  color = colors.primary,
  unit = '',
  emptyText = 'Add at least two entries to see a trend',
  decimals = 1,
}: {
  data: Point[];
  height?: number;
  color?: string;
  unit?: string;
  emptyText?: string;
  decimals?: number;
}) {
  const [w, onLayout] = useWidth();
  const padL = 40;
  const padR = 10;
  const padT = 14;
  const padB = 22;
  const plotW = Math.max(10, w - padL - padR);
  const plotH = height - padT - padB;
  const vals = data.map((d) => d.value);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (!isFinite(min) || !isFinite(max)) {
    min = 0;
    max = 1;
  }
  const span = max - min || Math.max(1, Math.abs(max) * 0.1);
  const lo = min - span * 0.2;
  const hi = max + span * 0.2;
  const X = (i: number) => padL + (data.length === 1 ? plotW / 2 : (plotW * i) / (data.length - 1));
  const Y = (v: number) => padT + plotH * (1 - (v - lo) / (hi - lo));
  const fmt = (v: number) => (Math.round(v * Math.pow(10, decimals)) / Math.pow(10, decimals)).toString();
  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(d.value).toFixed(1)}`).join(' ');
  const area = data.length > 1 ? `${path} L${X(data.length - 1).toFixed(1)},${padT + plotH} L${X(0).toFixed(1)},${padT + plotH} Z` : '';
  return (
    <View onLayout={onLayout} style={{ width: '100%' }}>
      {data.length < 2 ? (
        <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
          <AppText muted variant="caption" center>
            {data.length === 1 ? `Latest: ${fmt(data[0].value)} ${unit}. ${emptyText}` : emptyText}
          </AppText>
        </View>
      ) : (
        <Svg width={w} height={height}>
          <Defs>
            <LinearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.35} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {[0, 0.5, 1].map((f) => {
            const v = lo + (hi - lo) * f;
            const y = Y(v);
            return (
              <G key={f}>
                <Line x1={padL} x2={w - padR} y1={y} y2={y} stroke={colors.border} strokeWidth={1} />
                <SvgText x={padL - 6} y={y + 4} fontSize={10} fill={colors.textDim} textAnchor="end">
                  {fmt(v)}
                </SvgText>
              </G>
            );
          })}
          <Path d={area} fill="url(#lg)" />
          <Path d={path} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {data.map((d, i) => (
            <Circle key={i} cx={X(i)} cy={Y(d.value)} r={data.length > 30 ? 0 : 3.5} fill={colors.bg} stroke={color} strokeWidth={2} />
          ))}
          <SvgText x={padL} y={height - 6} fontSize={10} fill={colors.textDim} textAnchor="start">
            {data[0].label}
          </SvgText>
          <SvgText x={w - padR} y={height - 6} fontSize={10} fill={colors.textDim} textAnchor="end">
            {data[data.length - 1].label}
          </SvgText>
        </Svg>
      )}
      {unit && data.length >= 2 ? (
        <AppText variant="caption" muted style={{ textAlign: 'right' }}>
          {unit}
        </AppText>
      ) : null}
    </View>
  );
}

export function ProgressRing({
  value,
  size = 120,
  stroke = 11,
  color = colors.primary,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const v = Math.max(0, Math.min(1, isFinite(value) ? value : 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceAlt} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

export function WaterGlass({ value, size = 150 }: { value: number; size?: number }) {
  const v = Math.max(0, Math.min(1, value));
  const W = 100;
  const H = 130;
  const top = 8;
  const bottom = 122;
  const level = bottom - (bottom - top) * v;
  const glass = `M20,${top} L80,${top} L72,${bottom} Q72,${bottom + 4} 68,${bottom + 4} L32,${bottom + 4} Q28,${bottom + 4} 28,${bottom} Z`;
  return (
    <Svg width={size} height={(size * H) / W} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <ClipPath id="glassClip">
          <Path d={glass} />
        </ClipPath>
        <LinearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#4DA3FF" stopOpacity={0.95} />
          <Stop offset="1" stopColor="#1F6FD1" stopOpacity={0.95} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={level} width={W} height={H} fill="url(#waterGrad)" clipPath="url(#glassClip)" />
      <Path d={glass} stroke={colors.textMuted} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
    </Svg>
  );
}
