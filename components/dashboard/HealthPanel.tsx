import React from 'react';
import { Shield, Scale, Flame, Package } from 'lucide-react';
import { useHealthMonitoring } from '../../hooks/useHealthMonitoring';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import AnimateIn from './shared/AnimateIn';
import TodaySection from './health/TodaySection';
import MedicationSchedule from './health/MedicationSchedule';
import WeightChart from './health/WeightChart';
import TrainingSchedule from './health/TrainingSchedule';
import InventoryList from './health/InventoryList';

const HealthPanel: React.FC = () => {
  const {
    medications,
    medicationLogs,
    weightLogs,
    inventory,
    trainingSchedule,
    trainingLogs,
    loading,
    refresh,
    stats,
    logMedication,
    logWeight,
    logTraining,
    updateInventory,
    addMedication,
    deleteMedication,
    toggleMedication,
    addInventoryItem,
    deleteInventoryItem,
    updateTrainingSchedule,
  } = useHealthMonitoring();

  const { lastRefreshed } = useAutoRefresh(refresh, {
    realtimeTables: [
      'health_medications',
      'health_medication_logs',
      'health_weight_logs',
      'health_inventory',
      'health_training_logs',
    ],
  });

  if (loading) return <LoadingSkeleton cards={4} rows={6} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Health</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {/* Stat Cards */}
      <AnimateIn>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Compliance (7d)"
            value={`${stats.complianceRate}%`}
            icon={<Shield className="w-5 h-5" />}
            color="text-emerald-400"
          />
          <StatCard
            label="Weight"
            value={stats.currentWeight > 0 ? `${stats.currentWeight} kg` : '—'}
            icon={<Scale className="w-5 h-5" />}
            color="text-cyan-400"
            trend={stats.weightTrend !== 0 ? { value: stats.weightTrend, label: 'vs 7d ago' } : undefined}
          />
          <StatCard
            label="Streak"
            value={`${stats.streakDays}d`}
            icon={<Flame className="w-5 h-5" />}
            color="text-violet-400"
          />
          <StatCard
            label="Low Stock"
            value={stats.lowStockItems}
            icon={<Package className="w-5 h-5" />}
            color={stats.lowStockItems > 0 ? 'text-amber-400' : 'text-emerald-400'}
          />
        </div>
      </AnimateIn>

      {/* Today */}
      <AnimateIn delay={100}>
        <TodaySection
          todaysMeds={stats.todaysMeds}
          todaysWorkout={stats.todaysWorkout}
          medicationLogs={medicationLogs}
          trainingLogs={trainingLogs}
          todayTrainingDone={stats.todayTrainingDone}
          logMedication={logMedication}
          logTraining={logTraining}
        />
      </AnimateIn>

      {/* Medication Schedule + Weight Chart — side by side on larger screens */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <AnimateIn delay={200}>
          <MedicationSchedule
            medications={medications}
            medicationLogs={medicationLogs}
            addMedication={addMedication}
            toggleMedication={toggleMedication}
            deleteMedication={deleteMedication}
          />
        </AnimateIn>
        <AnimateIn delay={300}>
          <WeightChart
            weightLogs={weightLogs}
            logWeight={logWeight}
          />
        </AnimateIn>
      </div>

      {/* Training Schedule */}
      <AnimateIn delay={400}>
        <TrainingSchedule
          trainingSchedule={trainingSchedule}
          trainingLogs={trainingLogs}
          logTraining={logTraining}
          updateTrainingSchedule={updateTrainingSchedule}
        />
      </AnimateIn>

      {/* Inventory */}
      <AnimateIn delay={500}>
        <InventoryList
          inventory={inventory}
          updateInventory={updateInventory}
          addInventoryItem={addInventoryItem}
          deleteInventoryItem={deleteInventoryItem}
        />
      </AnimateIn>
    </div>
  );
};

export default HealthPanel;
