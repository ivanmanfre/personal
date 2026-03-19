import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { dashboardAction } from '../lib/dashboardActions';
import type { HealthMedication, MedicationLog, WeightLog, InventoryItem, TrainingDay } from '../types/dashboard';

function mapMedication(row: any): HealthMedication {
  return {
    id: row.id,
    name: row.name,
    dosage: row.dosage,
    frequency: row.frequency,
    scheduleDays: row.schedule_days || [],
    scheduleTime: row.schedule_time || '09:00',
    lastTakenAt: row.last_taken_at,
    nextDueAt: row.next_due_at,
    isActive: row.is_active,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function mapMedLog(row: any): MedicationLog {
  return {
    id: row.id,
    medicationId: row.medication_id,
    takenAt: row.taken_at,
    source: row.source,
    notes: row.notes,
  };
}

function mapWeightLog(row: any): WeightLog {
  return {
    id: row.id,
    weightKg: Number(row.weight_kg),
    loggedAt: row.logged_at,
    source: row.source,
    notes: row.notes,
  };
}

function mapInventory(row: any): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    quantity: Number(row.quantity),
    unit: row.unit,
    lowStockThreshold: Number(row.low_stock_threshold),
    isActive: row.is_active,
    lastUpdatedAt: row.last_updated_at,
    notes: row.notes,
  };
}

function mapTrainingDay(row: any): TrainingDay {
  return {
    id: row.id,
    dayOfWeek: row.day_of_week,
    routineName: row.routine_name,
    exercises: row.exercises,
    isActive: row.is_active,
  };
}

function getIsoDow(): number {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

/** Check Supabase RPC response and throw on error */
function checkRpc(result: { error: any }) {
  if (result.error) throw result.error;
}

export function useHealthMonitoring() {
  const [medications, setMedications] = useState<HealthMedication[]>([]);
  const [medicationLogs, setMedicationLogs] = useState<MedicationLog[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [trainingSchedule, setTrainingSchedule] = useState<TrainingDay[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch 30 days of med logs for streak calculation
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      const [medsRes, logsRes, weightRes, inventoryRes, scheduleRes] = await Promise.all([
        supabase.from('health_medications').select('*').order('name'),
        supabase.from('health_medication_logs').select('*').gte('taken_at', thirtyDaysAgo).order('taken_at', { ascending: false }),
        supabase.from('health_weight_logs').select('*').order('logged_at', { ascending: false }).limit(90),
        supabase.from('health_inventory').select('*').eq('is_active', true).order('name'),
        supabase.from('health_training_schedule').select('*').eq('is_active', true).order('day_of_week'),
      ]);

      setMedications((medsRes.data || []).map(mapMedication));
      setMedicationLogs((logsRes.data || []).map(mapMedLog));
      setWeightLogs((weightRes.data || []).map(mapWeightLog));
      setInventory((inventoryRes.data || []).map(mapInventory));
      setTrainingSchedule((scheduleRes.data || []).map(mapTrainingDay));
    } catch (err) {
      console.error('Failed to fetch health data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const stats = useMemo(() => {
    const todayDow = getIsoDow();
    const activeMeds = medications.filter(m => m.isActive && m.frequency !== 'as_needed');

    // Today's medications (include as_needed in display but not compliance)
    const todaysMeds = medications.filter(m =>
      m.isActive && (m.frequency === 'daily' || m.scheduleDays.includes(todayDow))
    );

    // Today's workout
    const todaysWorkout = trainingSchedule.find(t => t.dayOfWeek === todayDow) || null;

    // Compliance rate (7d): expected vs actual doses
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const recentLogs = medicationLogs.filter(l => new Date(l.takenAt).getTime() >= sevenDaysAgo);
    const expectedDoses7d = activeMeds.reduce((sum, med) => {
      if (med.frequency === 'daily') return sum + 7;
      if (med.frequency === 'weekly') return sum + 1;
      if (med.frequency === 'twice_weekly') return sum + 2;
      return sum;
    }, 0);
    const actualDoses7d = recentLogs.filter(l =>
      activeMeds.some(m => m.id === l.medicationId)
    ).length;
    const complianceRate = expectedDoses7d > 0 ? Math.min(100, Math.round((actualDoses7d / expectedDoses7d) * 100)) : 100;

    // Current weight + trend
    const currentWeight = weightLogs.length > 0 ? weightLogs[0].weightKg : 0;
    const weekAgoWeight = weightLogs.find(w => {
      const diff = Date.now() - new Date(w.loggedAt).getTime();
      return diff >= 6 * 86400000;
    });
    const weightTrend = weekAgoWeight ? +(currentWeight - weekAgoWeight.weightKg).toFixed(1) : 0;

    // Low stock
    const lowStockItems = inventory.filter(i => i.quantity <= i.lowStockThreshold).length;

    // Streak: consecutive days where all scheduled active meds were taken (up to 30d)
    let streakDays = 0;
    for (let d = 0; d < 30; d++) {
      const checkDate = new Date(Date.now() - d * 86400000);
      const checkDow = checkDate.getDay() === 0 ? 7 : checkDate.getDay();
      const checkStr = checkDate.toDateString();
      const scheduledMeds = activeMeds.filter(m =>
        m.frequency === 'daily' || m.scheduleDays.includes(checkDow)
      );
      if (scheduledMeds.length === 0) { streakDays++; continue; }
      const allTaken = scheduledMeds.every(m =>
        medicationLogs.some(l => l.medicationId === m.id && new Date(l.takenAt).toDateString() === checkStr)
      );
      if (allTaken) streakDays++;
      else break;
    }

    return {
      complianceRate,
      currentWeight,
      weightTrend,
      lowStockItems,
      todaysMeds,
      todaysWorkout,
      streakDays,
      activeMedCount: activeMeds.length,
    };
  }, [medications, medicationLogs, weightLogs, inventory, trainingSchedule]);

  // ─── Mutations ───

  const logMedication = useCallback(async (medicationId: string, notes?: string) => {
    const tempLog: MedicationLog = {
      id: crypto.randomUUID(),
      medicationId,
      takenAt: new Date().toISOString(),
      source: 'dashboard',
      notes: notes || null,
    };
    setMedicationLogs(prev => [tempLog, ...prev]);
    setMedications(prev => prev.map(m => m.id === medicationId ? { ...m, lastTakenAt: new Date().toISOString() } : m));

    try {
      checkRpc(await supabase.rpc('health_log_medication', { p_medication_id: medicationId, p_source: 'dashboard', p_notes: notes || null }));
    } catch (err) {
      console.error('Failed to log medication:', err);
      setMedicationLogs(prev => prev.filter(l => l.id !== tempLog.id));
      await fetchAll();
    }
  }, [fetchAll]);

  const logWeight = useCallback(async (weightKg: number, notes?: string) => {
    const tempLog: WeightLog = {
      id: crypto.randomUUID(),
      weightKg,
      loggedAt: new Date().toISOString(),
      source: 'dashboard',
      notes: notes || null,
    };
    setWeightLogs(prev => [tempLog, ...prev]);

    try {
      checkRpc(await supabase.rpc('health_log_weight', { p_weight_kg: weightKg, p_source: 'dashboard', p_notes: notes || null }));
    } catch (err) {
      console.error('Failed to log weight:', err);
      setWeightLogs(prev => prev.filter(l => l.id !== tempLog.id));
    }
  }, []);

  const updateInventory = useCallback(async (id: string, quantity: number) => {
    setInventory(prev => prev.map(i => i.id === id ? { ...i, quantity } : i));
    try {
      await dashboardAction('health_inventory', id, 'quantity', String(quantity));
    } catch (err) {
      console.error('Failed to update inventory:', err);
      await fetchAll();
    }
  }, [fetchAll]);

  const addMedication = useCallback(async (name: string, dosage: string, frequency: string, scheduleDays: number[], scheduleTime: string, notes?: string) => {
    try {
      checkRpc(await supabase.rpc('health_add_medication', {
        p_name: name,
        p_dosage: dosage,
        p_frequency: frequency,
        p_schedule_days: scheduleDays,
        p_schedule_time: scheduleTime,
        p_notes: notes || null,
      }));
      await fetchAll();
    } catch (err) {
      console.error('Failed to add medication:', err);
    }
  }, [fetchAll]);

  const deleteMedication = useCallback(async (id: string) => {
    if (!confirm('Delete this medication and all its logs?')) return;
    setMedications(prev => prev.filter(m => m.id !== id));
    try {
      checkRpc(await supabase.rpc('health_delete_medication', { p_id: id }));
    } catch (err) {
      console.error('Failed to delete medication:', err);
      await fetchAll();
    }
  }, [fetchAll]);

  const toggleMedication = useCallback(async (id: string, isActive: boolean) => {
    setMedications(prev => prev.map(m => m.id === id ? { ...m, isActive } : m));
    try {
      await dashboardAction('health_medications', id, 'is_active', String(isActive));
    } catch (err) {
      console.error('Failed to toggle medication:', err);
      setMedications(prev => prev.map(m => m.id === id ? { ...m, isActive: !isActive } : m));
    }
  }, []);

  const addInventoryItem = useCallback(async (name: string, quantity: number, unit: string, lowStockThreshold: number, notes?: string) => {
    try {
      checkRpc(await supabase.rpc('health_add_inventory', {
        p_name: name,
        p_quantity: quantity,
        p_unit: unit,
        p_low_stock_threshold: lowStockThreshold,
        p_notes: notes || null,
      }));
      await fetchAll();
    } catch (err) {
      console.error('Failed to add inventory item:', err);
    }
  }, [fetchAll]);

  const deleteInventoryItem = useCallback(async (id: string) => {
    if (!confirm('Delete this inventory item?')) return;
    setInventory(prev => prev.filter(i => i.id !== id));
    try {
      checkRpc(await supabase.rpc('health_delete_inventory', { p_id: id }));
    } catch (err) {
      console.error('Failed to delete inventory item:', err);
      await fetchAll();
    }
  }, [fetchAll]);

  const updateTrainingSchedule = useCallback(async (dayOfWeek: number, routineName: string, exercises?: string) => {
    setTrainingSchedule(prev => prev.map(t => t.dayOfWeek === dayOfWeek ? { ...t, routineName, exercises: exercises || null } : t));
    try {
      checkRpc(await supabase.rpc('health_update_training', {
        p_day_of_week: dayOfWeek,
        p_routine_name: routineName,
        p_exercises: exercises || null,
      }));
    } catch (err) {
      console.error('Failed to update training schedule:', err);
      await fetchAll();
    }
  }, [fetchAll]);

  return {
    medications,
    medicationLogs,
    weightLogs,
    inventory,
    trainingSchedule,
    loading,
    refresh: fetchAll,
    stats,
    logMedication,
    logWeight,
    updateInventory,
    addMedication,
    deleteMedication,
    toggleMedication,
    addInventoryItem,
    deleteInventoryItem,
    updateTrainingSchedule,
  };
}
