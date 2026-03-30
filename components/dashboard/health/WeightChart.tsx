import React, { useState, useMemo } from 'react';
import { Scale, Plus } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useDashboard } from '../../../contexts/DashboardContext';
import PanelCard from '../shared/PanelCard';
import { formatDate } from '../shared/utils';
import type { WeightLog } from '../../../types/dashboard';

interface Props {
  weightLogs: WeightLog[];
  logWeight: (weightKg: number, notes?: string) => Promise<void>;
}

const tooltipStyle = {
  backgroundColor: '#18181b',
  border: '1px solid rgba(63, 63, 70, 0.6)',
  borderRadius: 10,
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  padding: '8px 12px',
};

const WeightChart: React.FC<Props> = ({ weightLogs, logWeight }) => {
  const [inputWeight, setInputWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const { userTimezone } = useDashboard();

  const chartData = useMemo(() =>
    [...weightLogs].reverse().map(w => ({
      date: formatDate(w.loggedAt, { month: 'short', day: 'numeric' }, userTimezone),
      weight: w.weightKg,
    })),
  [weightLogs, userTimezone]);

  const handleLog = async () => {
    const val = parseFloat(inputWeight);
    if (!val || val < 20 || val > 300) return;
    setSaving(true);
    await logWeight(val);
    setInputWeight('');
    setSaving(false);
  };

  return (
    <PanelCard
      title="Weight"
      icon={<Scale className="w-4 h-4" />}
      badge={weightLogs.length > 0 ? `${weightLogs[0].weightKg} kg` : undefined}
      accent="cyan"
      headerRight={
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.1"
            min="20"
            max="300"
            value={inputWeight}
            onChange={e => setInputWeight(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLog()}
            placeholder="kg"
            className="w-20 px-2 py-1 text-xs bg-zinc-800 border border-zinc-700/60 rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50"
          />
          <button
            onClick={handleLog}
            disabled={saving || !inputWeight}
            className="p-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      }
    >
      <div className="p-4">
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(63,63,70,0.3)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={false} />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fill: '#71717a' }}
                tickLine={false}
                axisLine={false}
                width={35}
                tickFormatter={v => `${v}`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: '#a1a1aa', fontSize: 11 }}
                itemStyle={{ color: '#22d3ee', fontSize: 12 }}
                formatter={(v: number) => [`${v} kg`, 'Weight']}
              />
              <Area
                type="monotone"
                dataKey="weight"
                stroke="#22d3ee"
                strokeWidth={2}
                fill="url(#weightGradient)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: '#22d3ee' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-sm text-zinc-500">
            Log your weight to see the chart
          </div>
        )}
      </div>
    </PanelCard>
  );
};

export default WeightChart;
