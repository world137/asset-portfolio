// DonutChart — ported arc math from src/components/Charts.jsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

interface Slice { label: string; value: number; color: string; }

interface Props {
  slices: Slice[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSub?: string;
}

function polarToCart(cx: number, cy: number, r: number, angle: number) {
  const rad = (angle - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function buildArc(cx: number, cy: number, r: number, start: number, end: number): string {
  const s = polarToCart(cx, cy, r, start);
  const e = polarToCart(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

export default function DonutChart({ slices, size = 200, strokeWidth = 28, centerLabel, centerSub }: Props) {
  const cx = size / 2, cy = size / 2;
  const r  = (size - strokeWidth) / 2;
  const total = slices.reduce((s, d) => s + d.value, 0);

  if (total <= 0) {
    return (
      <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        <Circle cx={cx} cy={cy} r={r} stroke="#e8ebf1" strokeWidth={strokeWidth} fill="none" />
      </View>
    );
  }

  let startAngle = 0;
  const paths = slices
    .filter(s => s.value > 0)
    .map((slice, i) => {
      const sweep = (slice.value / total) * 360;
      const endAngle = startAngle + sweep;
      const d = buildArc(cx, cy, r, startAngle, endAngle - 0.5);
      startAngle = endAngle;
      return <Path key={i} d={d} stroke={slice.color} strokeWidth={strokeWidth} fill="none" strokeLinecap="butt" />;
    });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* background ring */}
        <Circle cx={cx} cy={cy} r={r} stroke="#e8ebf1" strokeWidth={strokeWidth} fill="none" />
        {paths}
      </Svg>
      {(centerLabel || centerSub) && (
        <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
          {centerLabel && <Text style={{ fontSize: 15, fontWeight: '700', color: '#0e1726' }}>{centerLabel}</Text>}
          {centerSub   && <Text style={{ fontSize: 11, color: '#7a869a', marginTop: 2 }}>{centerSub}</Text>}
        </View>
      )}
    </View>
  );
}
