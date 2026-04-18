interface AvatarProps {
  name?: string
  src?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
}

function initials(name?: string) {
  if (!name) return '?'
  return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

function colorFor(name?: string) {
  if (!name) return 'bg-gray-400'
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  const palette = [
    'bg-indigo-500', 'bg-rose-500', 'bg-emerald-500',
    'bg-amber-500', 'bg-sky-500', 'bg-purple-500',
    'bg-pink-500', 'bg-teal-500',
  ]
  return palette[h % palette.length]
}

export default function Avatar({ name, src, size = 'md', className = '' }: AvatarProps) {
  const base = `inline-flex items-center justify-center rounded-full text-white font-semibold select-none ${sizeMap[size]} ${className}`
  if (src) {
    return <img src={src} alt={name ?? ''} className={`${base} object-cover`} />
  }
  return <div className={`${base} ${colorFor(name)}`}>{initials(name)}</div>
}
