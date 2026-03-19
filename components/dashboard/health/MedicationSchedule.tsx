import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pill, Plus, X, Eye, EyeOff, Trash2 } from 'lucide-react';
import PanelCard from '../shared/PanelCard';
import type { HealthMedication, MedicationLog } from '../../../types/dashboard';

interface Props {
  medications: HealthMedication[];
  medicationLogs: MedicationLog[];
  addMedication: (name: string, dosage: string, frequency: string, scheduleDays: number[], scheduleTime: string, notes?: string) => Promise<void>;
  toggleMedication: (id: string, isActive: boolean) => Promise<void>;
  deleteMedication: (id: string) => Promise<void>;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FREQ_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'twice_weekly', label: '2x/week' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'as_needed', label: 'As needed' },
];

const MedicationSchedule: React.FC<Props> = ({ medications, medicationLogs, addMedication, toggleMedication, deleteMedication }) => {
  const [showInactive, setShowInactive] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', dosage: '', frequency: 'daily', scheduleDays: [] as number[], scheduleTime: '09:00', notes: '' });

  const activeMeds = medications.filter(m => m.isActive);
  const inactiveMeds = medications.filter(m => !m.isActive);
  const displayMeds = showInactive ? medications : activeMeds;

  const todayStr = new Date().toDateString();

  const toggleDay = (day: number) => {
    setForm(f => ({
      ...f,
      scheduleDays: f.scheduleDays.includes(day) ? f.scheduleDays.filter(d => d !== day) : [...f.scheduleDays, day],
    }));
  };

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    const days = form.frequency === 'daily' ? [1, 2, 3, 4, 5, 6, 7] : form.scheduleDays;
    await addMedication(form.name, form.dosage, form.frequency, days, form.scheduleTime, form.notes || undefined);
    setForm({ name: '', dosage: '', frequency: 'daily', scheduleDays: [], scheduleTime: '09:00', notes: '' });
    setAdding(false);
  };

  return (
    <PanelCard
      title="Medications"
      icon={<Pill className="w-4 h-4" />}
      badge={activeMeds.length}
      accent="blue"
      headerRight={
        <div className="flex items-center gap-2">
          {inactiveMeds.length > 0 && (
            <button
              onClick={() => setShowInactive(!showInactive)}
              className="p-1 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
              title={showInactive ? 'Hide inactive' : 'Show inactive'}
            >
              {showInactive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            onClick={() => setAdding(!adding)}
            className="p-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors"
          >
            {adding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          </button>
        </div>
      }
    >
      {/* Add Medication Form */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-zinc-800/40"
          >
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Name"
                  className="px-2.5 py-1.5 text-xs bg-zinc-800 border border-zinc-700/60 rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50"
                />
                <input
                  value={form.dosage}
                  onChange={e => setForm(f => ({ ...f, dosage: e.target.value }))}
                  placeholder="Dosage (e.g. 5mg)"
                  className="px-2.5 py-1.5 text-xs bg-zinc-800 border border-zinc-700/60 rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={form.frequency}
                  onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                  className="px-2.5 py-1.5 text-xs bg-zinc-800 border border-zinc-700/60 rounded-lg text-zinc-200 focus:outline-none focus:border-blue-500/50"
                >
                  {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input
                  type="time"
                  value={form.scheduleTime}
                  onChange={e => setForm(f => ({ ...f, scheduleTime: e.target.value }))}
                  className="px-2.5 py-1.5 text-xs bg-zinc-800 border border-zinc-700/60 rounded-lg text-zinc-200 focus:outline-none focus:border-blue-500/50"
                />
              </div>
              {form.frequency !== 'daily' && form.frequency !== 'as_needed' && (
                <div className="flex gap-1">
                  {DAY_LABELS.map((label, i) => {
                    const day = i + 1;
                    const selected = form.scheduleDays.includes(day);
                    return (
                      <button
                        key={day}
                        onClick={() => toggleDay(day)}
                        className={`flex-1 py-1 text-[10px] font-medium rounded transition-colors ${
                          selected
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-zinc-800 text-zinc-500 border border-zinc-700/40 hover:text-zinc-300'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setAdding(false)} className="px-3 py-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Cancel</button>
                <button
                  onClick={handleAdd}
                  disabled={!form.name.trim()}
                  className="px-3 py-1 text-xs bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Weekly Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800/40">
              <th className="text-left px-4 py-2 text-zinc-500 font-medium w-32">Medication</th>
              {DAY_LABELS.map((d, i) => (
                <th key={i} className="text-center px-1 py-2 text-zinc-500 font-medium w-10">{d}</th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {displayMeds.map(med => {
              const isScheduledDay = (dow: number) =>
                med.frequency === 'daily' || med.scheduleDays.includes(dow);

              const isTakenOnDay = (dow: number) => {
                // Only check last 7 days
                for (let d = 0; d < 7; d++) {
                  const checkDate = new Date(Date.now() - d * 86400000);
                  const checkDow = checkDate.getDay() === 0 ? 7 : checkDate.getDay();
                  if (checkDow !== dow) continue;
                  const checkStr = checkDate.toDateString();
                  return medicationLogs.some(l =>
                    l.medicationId === med.id && new Date(l.takenAt).toDateString() === checkStr
                  );
                }
                return false;
              };

              return (
                <tr key={med.id} className={`border-b border-zinc-800/20 ${!med.isActive ? 'opacity-40' : ''}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-200 font-medium">{med.name}</span>
                      {med.dosage && <span className="text-zinc-600">{med.dosage}</span>}
                    </div>
                  </td>
                  {[1, 2, 3, 4, 5, 6, 7].map(dow => {
                    const scheduled = isScheduledDay(dow);
                    const taken = scheduled && isTakenOnDay(dow);
                    return (
                      <td key={dow} className="text-center px-1 py-2.5">
                        {scheduled ? (
                          <div className={`w-3 h-3 rounded-full mx-auto ${
                            taken ? 'bg-emerald-400' : 'bg-zinc-700'
                          }`} />
                        ) : (
                          <div className="w-3 h-3 mx-auto" />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-1 py-2.5">
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => toggleMedication(med.id, !med.isActive)}
                        className="p-0.5 text-zinc-600 hover:text-zinc-400 transition-colors"
                        title={med.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {med.isActive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => deleteMedication(med.id)}
                        className="p-0.5 text-zinc-600 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {displayMeds.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-sm text-zinc-500">
                  No medications — click + to add one
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PanelCard>
  );
};

export default MedicationSchedule;
