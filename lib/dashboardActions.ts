import { supabase } from './supabase';

export async function dashboardAction(table: string, id: string, field: string, value: string) {
  const { error } = await supabase.rpc('dashboard_action', {
    p_table: table,
    p_id: id,
    p_field: field,
    p_value: value,
  });
  if (error) throw error;
}
