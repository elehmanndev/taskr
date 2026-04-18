import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variantClass: Record<Variant, string> = {
  primary:   'bg-indigo-600 hover:bg-indigo-700 text-white',
  secondary: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300',
  ghost:     'bg-transparent hover:bg-gray-100 text-gray-700',
  danger:    'bg-red-600 hover:bg-red-700 text-white',
}

const sizeClass: Record<Size, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClass[variant]} ${sizeClass[size]} ${className}`}
    />
  )
}
