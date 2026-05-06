interface WordmarkProps {
  size?: 'sm' | 'md' | 'lg'
}

const SIZES: Record<NonNullable<WordmarkProps['size']>, string> = {
  sm: '1.5rem',
  md: '2.25rem',
  lg: '4.5rem',
}

export default function Wordmark({ size = 'sm' }: WordmarkProps) {
  const fontSize = SIZES[size]
  const baseStyle: React.CSSProperties = {
    fontSize,
    letterSpacing: '-0.055em',
    fontFeatureSettings: '"ss01", "cv11"',
  }
  return (
    <span className="inline-flex items-end leading-none select-none">
      <span className="text-text-primary font-extrabold lowercase" style={baseStyle}>
        taskr
      </span>
      <span
        aria-hidden
        className="font-extrabold lowercase"
        style={{
          ...baseStyle,
          backgroundImage: 'linear-gradient(135deg, var(--accent), #a25ddc)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginLeft: '-0.05em',
        }}
      >
        .
      </span>
    </span>
  )
}
