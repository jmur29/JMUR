import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { cn } from '../../lib/utils';

interface RatioGaugeProps {
  value: number;
  threshold: number;
  label: string;
  format?: (v: number) => string;
  className?: string;
}

function getGaugeColor(value: number, threshold: number): string {
  const ratio = value / threshold;
  if (ratio < 0.8) return '#22c55e'; // green-500
  if (ratio <= 1.0) return '#f59e0b'; // amber-500
  return '#ef4444'; // red-500
}

export default function RatioGauge({
  value,
  threshold,
  label,
  format,
  className,
}: RatioGaugeProps) {
  const color = getGaugeColor(value, threshold);
  const displayValue = format ? format(value) : `${value.toFixed(1)}%`;
  // Cap the filled bar at 100% of the arc for display, but still show actual value
  const fillPct = Math.min((value / threshold) * 100, 120); // allow slight overflow
  const thresholdPct = 100;

  const data = [
    {
      name: 'threshold',
      value: thresholdPct,
      fill: '#e2e8f0', // slate-200
    },
    {
      name: 'value',
      value: fillPct,
      fill: color,
    },
  ];

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative w-36 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="65%"
            outerRadius="90%"
            startAngle={220}
            endAngle={-40}
            data={data}
            barSize={10}
          >
            <PolarAngleAxis type="number" domain={[0, 120]} angleAxisId={0} tick={false} />
            <RadialBar
              dataKey="value"
              cornerRadius={5}
              background={false}
              isAnimationActive={true}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-slate-900" style={{ color }}>
            {displayValue}
          </span>
          <span className="text-xs text-slate-400">/ {threshold}%</span>
        </div>
      </div>
      <p className="text-sm font-medium text-slate-700 mt-1">{label}</p>
      <p className="text-xs text-slate-400">Threshold: {threshold}%</p>
    </div>
  );
}
