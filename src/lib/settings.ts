const KEY = 'avicontrol.settings'

export interface Settings {
  moneda: string
  granja: string
}

const defaults: Settings = { moneda: 'RD$', granja: 'Mi granja' }

export function getSettings(): Settings {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return defaults
  }
}

export function saveSettings(patch: Partial<Settings>) {
  const next = { ...getSettings(), ...patch }
  localStorage.setItem(KEY, JSON.stringify(next))
  window.dispatchEvent(new Event('settings-changed'))
  return next
}
