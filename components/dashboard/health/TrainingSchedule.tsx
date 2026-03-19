import React, { useState } from 'react';
import { Dumbbell, Pencil, Check, X } from 'lucide-react';
import PanelCard from '../shared/PanelCard';
import type { TrainingDay } from '../../../types/dashboard';

interface Props {
  trainingSchedule: TrainingDay[];
  updateTrainingSchedule: (dayOfWeek: number, routineName: string, exercises?: string) => Promise<void>;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TrainingSchedule: React.FC<Props> = ({ trainingSchedule, updateTrainingSchedule }) => {
  const [editing, setEditing] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ routineName: '', exercises: '' });

  const todayDow = (() => { const d = new Date().getDay(); return d === 0 ? 7 : d; })();

  const startEdit = (day: TrainingDay) => {
    setEditing(day.dayOfWeek);
    setEditForm({ routineName: day.routineName, exercises: day.exercises || '' });
  };

  const saveEdit = async () => {
    if (editing === null || !editForm.routineName.trim()) return;
    await updateTrainingSchedule(editing, editForm.routineName, editForm.exercises || undefined);
    setEditing(null);
  };

  return (
    <PanelCard
      title="Training"
      icon={<Dumbbell className="w-4 h-4" />}
      accent="purple"
    >
      <div className="grid grid-cols-7 gap-0 divide-x divide-zinc-800/30">
        {[1, 2, 3, 4, 5, 6, 7].map(dow => {
          const day = trainingSchedule.find(t => t.dayOfWeek === dow);
          const isToday = dow === todayDow;
          const isRest = day?.routineName === 'Rest';

          return (
            <div
              key={dow}
              className={`relative py-3 px-2 text-center ${
                isToday ? 'bg-purple-500/5' : ''
              }`}
            >
              {isToday && (
                <div className="absolute inset-x-0 top-0 h-[2px] bg-purple-500/60" />
              )}
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${
                isToday ? 'text-purple-400' : 'text-zinc-500'
              }`}>
                {DAY_LABELS[dow - 1]}
              </p>

              {editing === dow ? (
                <div className="space-y-1.5">
                  <input
                    value={editForm.routineName}
                    onChange={e => setEditForm(f => ({ ...f, routineName: e.target.value }))}
                    className="w-full px-1.5 py-1 text-[11px] bg-zinc-800 border border-zinc-700/60 rounded text-zinc-200 focus:outline-none focus:border-purple-500/50 text-center"
                    placeholder="Routine"
                  />
                  <input
                    value={editForm.exercises}
                    onChange={e => setEditForm(f => ({ ...f, exercises: e.target.value }))}
                    className="w-full px-1.5 py-1 text-[10px] bg-zinc-800 border border-zinc-700/60 rounded text-zinc-200 focus:outline-none focus:border-purple-500/50 text-center"
                    placeholder="Exercises"
                  />
                  <div className="flex justify-center gap-1">
                    <button onClick={saveEdit} className="p-0.5 text-emerald-400 hover:text-emerald-300">
                      <Check className="w-3 h-3" />
                    </button>
                    <button onClick={() => setEditing(null)} className="p-0.5 text-zinc-500 hover:text-zinc-300">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => day && startEdit(day)}
                  className="w-full group"
                >
                  <p className={`text-sm font-semibold ${
                    isRest ? 'text-zinc-600' : isToday ? 'text-purple-300' : 'text-zinc-200'
                  }`}>
                    {day?.routineName || '—'}
                  </p>
                  {day?.exercises && (
                    <p className="text-[10px] text-zinc-600 mt-0.5 leading-tight line-clamp-2">
                      {day.exercises}
                    </p>
                  )}
                  <Pencil className="w-2.5 h-2.5 text-zinc-600 mx-auto mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </PanelCard>
  );
};

export default TrainingSchedule;
