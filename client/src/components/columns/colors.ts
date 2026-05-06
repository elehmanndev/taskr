// Monday.com color palette → hex values for inline styles.
export const MONDAY_COLORS: Record<string, string> = {
  working_orange: '#FDAB3D',
  done_green: '#00C875',
  stuck_red: '#E2445C',
  dark_blue: '#225091',
  purple: '#A25DDC',
  explosive: '#D71E48',
  grass_green: '#037F4C',
  bright_blue: '#579BFC',
  saladish: '#9CD326',
  egg_yolk: '#FFCB00',
  blackish: '#333333',
  dark_red: '#BB3354',
  sofia_pink: '#FF158A',
  lipstick: '#FF5AC4',
  dark_purple: '#784BD1',
  bright_green: '#66CCFF',
  chili_blue: '#66CCFF',
  american_gray: '#808080',
  brown: '#7F5347',
  dark_orange: '#FF642E',
  sunset: '#FF7575',
  bubble: '#FAA1F1',
  peach: '#FFADAD',
  berry: '#7E3B8A',
  winter: '#6C6CFF',
  river: '#68A1BD',
  navy: '#1F4B6D',
  aquamarine: '#4ECCC6',
  indigo: '#5559DF',
}

export function colorHex(name: string | undefined, fallback = '#C4C4C4'): string {
  if (!name) return fallback
  if (/^#[0-9a-f]{3,8}$/i.test(name)) return name
  return MONDAY_COLORS[name] ?? fallback
}

/**
 * Darken a hex color until white text on it has decent contrast. Bright/light
 * brand tones (yellows, peach, oranges) get pulled toward their darker shade so
 * white labels stay legible across the full palette.
 */
export function darkenForContrast(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const toLin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const L = 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b)
  if (L <= 0.32) return hex
  const keep = Math.max(0.45, 1 - (L - 0.32) * 1.4)
  const mix = (c: number) => Math.round(c * keep + 0x14 * (1 - keep))
  const toHex = (c: number) => c.toString(16).padStart(2, '0')
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`
}
