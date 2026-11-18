'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

/**
 * Small hand-made SVG charts for the Dashboard (no chart library in the admin). One y axis, thin marks, a recessive grid, a
 * hover/tap tooltip per week or month, and a legend whenever there are two series or more.
 */

/** Categorical colours in a fixed order (validated palette: blue, orange, aqua, yellow, magenta, green) */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'];
export const LOSS = '#d03b3b';
export const MUTED = '#b8b6b0';
const GRID = '#ecebe8';
const AXIS_TEXT = '#6b6a66';

export interface ChartPoint {
  label: string;
  /** Shown in the tooltip, e.g. 'Nov 14 – Nov 20' */
  detail?: string;
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    setWidth(Math.floor(el.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** Round axis steps: 1, 2, 2.5, 5 x 10^n */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) max = min + 1;
  const raw = (max - min) / count;
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 1000) / 1000);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

export function Legend({ items }: { items: Array<{ name: string; color: string; dashed?: boolean }> }) {
  if (items.length < 2) return null;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2, rowGap: 0.5, mb: 1 }}>
      {items.map((item) => (
        <Box key={item.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 14, height: 0, borderTop: `3px ${item.dashed ? 'dashed' : 'solid'} ${item.color}`, borderRadius: 2 }} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{item.name}</Typography>
        </Box>
      ))}
    </Box>
  );
}

interface FrameProps {
  points: ChartPoint[];
  ticks: number[];
  format: (v: number) => string;
  height: number;
  /** The tooltip of the column under the pointer */
  tooltip: (index: number) => ReactNode;
  children: (geo: { x: (i: number) => number; y: (v: number) => number; band: number; plotLeft: number; plotRight: number }) => ReactNode;
}

/** Axis, grid, x labels, hover columns and tooltip shared by the charts */
function Frame({ points, ticks, format, height, tooltip, children }: FrameProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const top = 8;
  const bottom = 24;
  const labelWidth = Math.max(...ticks.map((t) => format(t).length)) * 6.5 + 8;
  const plotLeft = labelWidth;
  const plotRight = Math.max(plotLeft + 10, width - 6);
  const n = Math.max(points.length, 1);
  const band = (plotRight - plotLeft) / n;
  const x = (i: number) => plotLeft + band * (i + 0.5);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const y = (v: number) => top + (height - top - bottom) * (1 - (v - lo) / (hi - lo || 1));
  // show as many x labels as fit (about 48px each), counted back from the latest one so it always shows
  const every = Math.max(1, Math.ceil((n * 48) / Math.max(1, plotRight - plotLeft)));

  return (
    <Box ref={ref} sx={{ position: 'relative', width: '100%', userSelect: 'none' }} onPointerLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" style={{ display: 'block', overflow: 'visible' }}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={plotLeft} x2={plotRight} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#c9c7c1' : GRID} strokeWidth={1} />
              <text x={plotLeft - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS_TEXT}>{format(t)}</text>
            </g>
          ))}
          {points.map((p, i) =>
            (n - 1 - i) % every === 0 ? (
              <text key={p.label + i} x={x(i)} y={height - 6} textAnchor="middle" fontSize={11} fill={AXIS_TEXT}>{p.label}</text>
            ) : null
          )}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={top} y2={height - bottom} stroke="#9a9893" strokeWidth={1} strokeDasharray="3 3" />}
          {children({ x, y, band, plotLeft, plotRight })}
          {points.map((p, i) => (
            <rect
              key={`hit-${i}`}
              x={plotLeft + band * i}
              y={0}
              width={band}
              height={height - bottom}
              fill="transparent"
              onPointerEnter={() => setHover(i)}
              onPointerDown={() => setHover(i)}
            />
          ))}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: Math.min(Math.max(0, x(hover) + (x(hover) > width / 2 ? -12 : 12)), width),
            transform: x(hover) > width / 2 ? 'translateX(-100%)' : 'none',
            bgcolor: '#fff',
            border: '1px solid #e2e0db',
            borderRadius: 1.5,
            boxShadow: '0 4px 14px rgba(40,30,10,0.10)',
            px: 1.25,
            py: 0.75,
            pointerEvents: 'none',
            minWidth: 150,
            zIndex: 2,
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.25 }}>{points[hover].detail ?? points[hover].label}</Typography>
          {tooltip(hover)}
        </Box>
      )}
    </Box>
  );
}

export function TooltipRow({ color, name, value, strong }: { color?: string; name: string; value: string; strong?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12, lineHeight: 1.6 }}>
      {color && <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: color, flexShrink: 0 }} />}
      <Box sx={{ color: 'text.secondary', flex: 1 }}>{name}</Box>
      <Box sx={{ fontWeight: strong ? 700 : 600, fontVariantNumeric: 'tabular-nums' }}>{value}</Box>
    </Box>
  );
}

export interface LineSeries {
  name: string;
  color: string;
  values: number[];
  dashed?: boolean;
}

/** Lines over the weeks or months, one y axis */
export function LineChart({ points, series, format, height = 220 }: { points: ChartPoint[]; series: LineSeries[]; format: (v: number) => string; height?: number }) {
  const ticks = useMemo(() => {
    const all = series.flatMap((s) => s.values);
    return niceTicks(Math.min(0, ...all), Math.max(1, ...all));
  }, [series]);
  return (
    <>
      <Legend items={series} />
      <Frame
        points={points}
        ticks={ticks}
        format={format}
        height={height}
        tooltip={(i) => series.map((s) => <TooltipRow key={s.name} color={s.color} name={s.name} value={format(s.values[i] ?? 0)} />)}
      >
        {({ x, y }) =>
          series.map((s) => (
            <g key={s.name}>
              <polyline
                points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={s.dashed ? '5 4' : undefined}
              />
              {s.values.length <= 26 && s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={3} fill={s.color} stroke="#fff" strokeWidth={1.5} />)}
            </g>
          ))
        }
      </Frame>
    </>
  );
}

/** Bars from zero; negative bars are red. `extra` adds lines to the tooltip of each bar. */
export function BarChart({
  points,
  values,
  name,
  color = SERIES[0],
  format,
  height = 200,
  extra,
}: {
  points: ChartPoint[];
  values: number[];
  name: string;
  color?: string;
  format: (v: number) => string;
  height?: number;
  extra?: (i: number) => ReactNode;
}) {
  const ticks = useMemo(() => niceTicks(Math.min(0, ...values), Math.max(0.01, ...values)), [values]);
  return (
    <Frame
      points={points}
      ticks={ticks}
      format={format}
      height={height}
      tooltip={(i) => (
        <>
          <TooltipRow color={values[i] < 0 ? LOSS : color} name={name} value={format(values[i] ?? 0)} strong />
          {extra?.(i)}
        </>
      )}
    >
      {({ x, y, band }) =>
        values.map((v, i) => {
          const w = Math.max(2, Math.min(28, band * 0.6));
          const top = Math.min(y(v), y(0));
          const h = Math.max(v === 0 ? 0 : 1.5, Math.abs(y(v) - y(0)));
          return <rect key={i} x={x(i) - w / 2} y={top} width={w} height={h} rx={Math.min(3, w / 2)} fill={v < 0 ? LOSS : color} />;
        })
      }
    </Frame>
  );
}

/** Each week as a 100% bar split into parts (Cooked / Ready to eat / ...), 2px gap between the parts */
export function ShareBars({
  points,
  parts,
  height = 200,
  format,
}: {
  points: ChartPoint[];
  parts: Array<{ name: string; color: string; values: number[] }>;
  height?: number;
  format: (v: number) => string;
}) {
  const ticks = [0, 25, 50, 75, 100];
  return (
    <>
      <Legend items={parts} />
      <Frame
        points={points}
        ticks={ticks}
        format={(v) => `${v}%`}
        height={height}
        tooltip={(i) => {
          const sum = parts.reduce((s, p) => s + (p.values[i] ?? 0), 0);
          return parts.map((p) => (
            <TooltipRow key={p.name} color={p.color} name={p.name} value={sum > 0 ? `${Math.round(((p.values[i] ?? 0) / sum) * 100)}% · ${format(p.values[i] ?? 0)}` : '–'} />
          ));
        }}
      >
        {({ x, y, band }) =>
          points.map((_, i) => {
            const sum = parts.reduce((s, p) => s + (p.values[i] ?? 0), 0);
            if (!(sum > 0)) return null;
            const w = Math.max(3, Math.min(30, band * 0.62));
            let acc = 0;
            return (
              <g key={i}>
                {parts.map((p) => {
                  const share = ((p.values[i] ?? 0) / sum) * 100;
                  if (share <= 0) return null;
                  const yTop = y(acc + share);
                  const yBottom = y(acc);
                  acc += share;
                  const h = Math.max(0, yBottom - yTop - 2);
                  return <rect key={p.name} x={x(i) - w / 2} y={yTop + 1} width={w} height={h} rx={2} fill={p.color} />;
                })}
              </g>
            );
          })
        }
      </Frame>
    </>
  );
}
