import React from 'react';
import { IndexedUser } from '../types';

interface ActivityChartProps {
  user: IndexedUser;
}

export default function ActivityChart({ user }: ActivityChartProps) {
  const baseValue = Math.floor(user.total_views / 25) || 1200;

  const data = [
    { name: 'MON', value: Math.floor(baseValue * 0.40) },
    { name: 'TUE', value: Math.floor(baseValue * 0.65) },
    { name: 'WED', value: Math.floor(baseValue * 0.90) },
    { name: 'THU', value: Math.floor(baseValue * 0.55) },
    { name: 'FRI', value: Math.floor(baseValue * 0.75) },
    { name: 'SAT', value: Math.floor(baseValue * 0.30) },
    { name: 'SUN', value: Math.floor(baseValue * 0.45) },
  ];

  const maxVal = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="w-full select-none">
      <p className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest text-center mb-4 font-bold">
        WEEKLY ENGAGEMENT DISTRIBUTION
      </p>
      <div className="flex items-end gap-1.5 h-[110px]">
        {data.map((d, i) => (
          <div key={d.name} className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className="w-full rounded-t-[5px] transition-all duration-500"
              style={{
                height: `${Math.round((d.value / maxVal) * 90)}px`,
                backgroundColor: i === 2 ? '#C9A84C' : '#e4e4e4',
              }}
            />
            <span className="font-mono text-[8px] text-neutral-400 font-bold">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
