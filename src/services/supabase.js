import { createClient } from '@supabase/supabase-js'

// Obtener credenciales desde .env o desde localStorage (para configuración amigable en UI)
export function getSupabaseCredentials() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  
  const localUrl = localStorage.getItem('subligol_supabase_url')
  const localKey = localStorage.getItem('subligol_supabase_anon_key')

  const url = (envUrl && envUrl.trim() !== '') ? envUrl.trim() : (localUrl || '')
  const anonKey = (envKey && envKey.trim() !== '') ? envKey.trim() : (localKey || '')

  return { url, anonKey }
}

export function saveSupabaseCredentials(url, anonKey) {
  if (url) localStorage.setItem('subligol_supabase_url', url.trim())
  if (anonKey) localStorage.setItem('subligol_supabase_anon_key', anonKey.trim())
}

export function clearSupabaseCredentials() {
  localStorage.removeItem('subligol_supabase_url')
  localStorage.removeItem('subligol_supabase_anon_key')
}

export function isSupabaseConfigured() {
  const { url, anonKey } = getSupabaseCredentials()
  return Boolean(url && anonKey && url.startsWith('http'))
}

// Instancia dinámica o nula de cliente Supabase
let supabaseInstance = null

export function getSupabase() {
  const { url, anonKey } = getSupabaseCredentials()
  if (!url || !anonKey || !url.startsWith('http')) {
    return null
  }
  
  if (!supabaseInstance || supabaseInstance.supabaseUrl !== url) {
    supabaseInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
  }
  return supabaseInstance
}

export const supabase = getSupabase()
