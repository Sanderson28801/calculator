import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabasePublishableKey);

export interface CalcRecord {
  id: number;
  expression: string;
  result: string;
  created_at: string;
}

/**
 * Fetch the last `limit` calculations from Supabase, newest first.
 */
export async function getRecentCalculations(limit = 10): Promise<{ data: CalcRecord[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('calcs')
      .select('id, expression, result, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: (data as CalcRecord[]) ?? [], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Save a completed calculation { expression, result } to Supabase.
 */
export async function saveCalculation(
  expression: string,
  result: string
): Promise<{ data: CalcRecord | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('calcs')
      .insert([{ expression, result }])
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as CalcRecord, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}
