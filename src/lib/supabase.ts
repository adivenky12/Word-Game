import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const configured = Boolean(url && key && !url.includes('YOUR_PROJECT'))
export const supabase = configured ? createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  realtime: { params: { eventsPerSecond: 5 } },
}) : null

export async function api<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new Error('Supabase is not configured. Add the project URL and publishable key.')
  const { data, error } = await supabase.functions.invoke('game', { body: { action, ...payload } })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data as T
}
