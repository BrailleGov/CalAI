import type { ReactNode } from 'react';
import { clamp01 } from '../lib/format';

type ProgressRingProps = {
  value: number;
  label: string;
  children: ReactNode;
  size?: number;
  stroke?: number;
};

export function ProgressRing({
  value,
  label,
  children,
  size = 140,
  stroke = 10
}: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamp01(value));

  return (
    <div
      className="ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          className="ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center" aria-hidden="true">
        {children}
      </div>
    </div>
  );
}
