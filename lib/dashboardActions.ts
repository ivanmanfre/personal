import { toast } from 'sonner';
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

/** Show a toast error - call this in catch blocks across hooks */
export function toastError(action: string, err?: unknown) {
  let msg = 'Unknown error';
  if (err instanceof Error) {
    msg = err.message;
  } else if (err && typeof err === 'object' && 'message' in err) {
    msg = String((err as Record<string, unknown>).message);
  } else if (typeof err === 'string') {
    msg = err;
  }
  toast.error(`Failed to ${action}`, { description: msg });
}

/** Show a toast success */
export function toastSuccess(message: string) {
  toast.success(message);
}
