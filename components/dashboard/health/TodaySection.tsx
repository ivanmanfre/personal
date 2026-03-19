import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Dumbbell, Pill, Clock } from 'lucide-react';
import PanelCard from '../shared/PanelCard';
import type { HealthMedication, MedicationLog, TrainingDay, TrainingLog } from '../../../types/dashboard';

interface Props {
  todaysMeds: HealthMedication[];
  todaysWorkout: TrainingDay | null;
  medicationLogs: MedicationLog[];
  trainingLogs: TrainingLog[];
  todayTrainingDone: boolean;
  logMedication: (id: string) => Promise<void>;
  logTraining: (scheduleId: string) => Promise<void>;
}

const TodaySection: React.FC<Props> = ({
  todaysMeds,
  todaysWorkout,
  medicationLogs,
  trainingLogs,
  todayTrainingDone,
  logMedication,
  logTraining,
}) => {
  const todayStr = new Date().toDateString();

  const isTakenToday = (medId: string) =>
    medicationLogs.some(l => l.medicationId === medId && new Date(l.takenAt).toDateString() === todayStr);

  const takenCount = todaysMeds.filter(m => isTakenToday(m.id)).length;

  return (
    <PanelCard
      title="Today"
      icon={<Clock className="w-4 h-4" />}
      badge={`${takenCount}/${todaysMeds.length}`}
      accent="emerald"
    >
      <div className="divide-y divide-zinc-800/40">
        {/* Medications */}
        {todaysMeds.map((med, i) => {
          const taken = isTakenToday(med.id);
          return (
            <motion.div
              key={med.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/30 transition-colors"
            >
              <button
                onClick={() => !taken && logMedication(med.id)}
                disabled={taken}
                className="shrink-0"
              >
                {taken ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Circle className="w-5 h-5 text-zinc-600 hover:text-emerald-400 transition-colors" />
                )}
              </button>
              <Pill className={`w-3.5 h-3.5 shrink-0 ${taken ? 'text-emerald-400/50' : 'text-zinc-500'}`} />
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium ${taken ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                  {med.name}
                </span>
                {med.dosage && (
                  <span className="text-xs text-zinc-600 ml-2">{med.dosage}</span>
                )}
              </div>
              <span className="text-[11px] text-zinc-600 shrink-0">
                {med.scheduleTime?.slice(0, 5)}
              </span>
            </motion.div>
          );
        })}

        {/* Today's Workout */}
        {todaysWorkout && (
          <div className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/30 transition-colors">
            <button
              onClick={() => !todayTrainingDone && logTraining(todaysWorkout.id)}
              disabled={todayTrainingDone}
              className="shrink-0"
            >
              {todayTrainingDone ? (
                <CheckCircle2 className="w-5 h-5 text-violet-400" />
              ) : (
                <Circle className="w-5 h-5 text-zinc-600 hover:text-violet-400 transition-colors" />
              )}
            </button>
            <Dumbbell className={`w-3.5 h-3.5 shrink-0 ${todayTrainingDone ? 'text-violet-400/50' : 'text-violet-400'}`} />
            <div className="flex-1 min-w-0">
              <span className={`text-sm font-medium ${todayTrainingDone ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                {todaysWorkout.routineName}
              </span>
              {todaysWorkout.exercises && (
                <p className="text-xs text-zinc-600 mt-0.5 truncate">{todaysWorkout.exercises}</p>
              )}
            </div>
          </div>
        )}

        {todaysMeds.length === 0 && !todaysWorkout && (
          <div className="px-4 py-6 text-center text-sm text-zinc-500">Nothing scheduled today</div>
        )}
      </div>
    </PanelCard>
  );
};

export default TodaySection;
