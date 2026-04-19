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
