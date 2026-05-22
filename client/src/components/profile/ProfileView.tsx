import Avatar from '../ui/Avatar'
import type { User, LanguageCode, LanguageLevel } from '../../lib/types'

interface ProfileViewProps {
  user: User
}

const LANGUAGE_LABEL: Record<LanguageCode, string> = {
  es: 'Spanish', ca: 'Catalan', en: 'English', fr: 'French',
  pt: 'Portuguese', de: 'German', it: 'Italian',
}

const LEVEL_LABEL: Record<LanguageLevel, string> = {
  1: 'Native', 2: 'Fluent', 3: 'Intermediate', 4: 'Basic',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-1.5">{title}</div>
      <div className="text-sm text-text-primary">{children}</div>
    </div>
  )
}

function Chips({ items }: { items?: string[] }) {
  if (!items || items.length === 0) return <span className="text-text-muted">—</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <span key={s} className="bg-accent-soft text-accent px-2 py-0.5 rounded-full text-xs font-medium">
          {s}
        </span>
      ))}
    </div>
  )
}

function Languages({ value }: { value?: Partial<Record<LanguageCode, LanguageLevel>> }) {
  const entries = Object.entries(value ?? {}) as [LanguageCode, LanguageLevel][]
  if (entries.length === 0) return <span className="text-text-muted">—</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([code, level]) => (
        <span
          key={code}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ color: 'var(--accent)', backgroundColor: 'var(--accent-soft)' }}
          title={`Level ${level} · ${LEVEL_LABEL[level]}`}
        >
          {LANGUAGE_LABEL[code]}
          <span className="opacity-70">· {level}</span>
        </span>
      ))}
    </div>
  )
}

export default function ProfileView({ user }: ProfileViewProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <Avatar name={user.name} src={user.avatarUrl} size="lg" />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold truncate">{user.name}</h2>
          {user.department && (
            <div className="text-sm text-text-secondary">
              {user.department}
              {user.group && <span className="text-text-muted"> · {user.group}</span>}
            </div>
          )}
          <div className="text-xs text-text-secondary mt-1">
            <a href={`mailto:${user.email}`} className="text-accent hover:underline">{user.email}</a>
            {user.slackUrl && (
              <> · <a href={user.slackUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">Slack</a></>
            )}
          </div>
        </div>
      </div>

      {user.claudeMd && (
        <Section title="CLAUDE.md">
          <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-text-primary bg-surface-glass-strong/40 rounded-md p-3 border border-border-soft">
            {user.claudeMd}
          </pre>
        </Section>
      )}

      <Section title="Expertise & Knowledge">
        <Chips items={user.expertise} />
      </Section>

      <Section title="Languages">
        <Languages value={user.languages} />
      </Section>

    </div>
  )
}
