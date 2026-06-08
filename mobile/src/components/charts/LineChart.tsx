// LineChart — portfolio history line chart (react-native-svg)
import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Text as SvgText } from 'react-native-svg';

interface Point { date: string; value: number; }

interface Props {
  points: Point[];
  width: number;
  height?: number;
  color?: string;
  showGrid?: boolean;
}

export default function LineChart({ points, width, height = 120, color = '#9a6b1f', showGrid = true }: Props) {
  if (!points || points.length < 2) return <View style={{ width, height }} />;

  const pad = { top: 8, right: 8, bottom: 20, left: 8 };
  const w = width  - pad.left - pad.right;
  const h = height - pad.top  - pad.bottom;

  const vals = points.map(p => p.value);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;

  const toX = (i: number) => pad.left + (i / (points.length - 1)) * w;
  const toY = (v: number) => pad.top  + (1 - (v - minV) / range) * h;

  // Build path
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.value).toFixed(1)}`).join(' ');
  // Fill area
  const fillD = `${d} L ${toX(points.length - 1).toFixed(1)} ${(pad.top + h).toFixed(1)} L ${pad.left} ${(pad.top + h).toFixed(1)} Z`;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="linefill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.22} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {showGrid && [0.25, 0.5, 0.75].map(f => (
          <Line
            key={f}
            x1={pad.left} x2={pad.left + w}
            y1={pad.top + f * h} y2={pad.top + f * h}
            stroke="#e8ebf1" strokeWidth={1}
          />
        ))}
        <Path d={fillD} fill="url(#linefill)" />
        <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
