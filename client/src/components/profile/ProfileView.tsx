import Avatar from '../ui/Avatar'
import type { User } from '../../lib/types'

interface ProfileViewProps {
  user: User
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{title}</div>
      <div className="text-sm text-gray-800">{children}</div>
    </div>
  )
}

function Chips({ items }: { items?: string[] }) {
  if (!items || items.length === 0) return <span className="text-gray-400">—</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <span key={s} className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">
          {s}
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
          {user.title && <div className="text-sm text-gray-600">{user.title}</div>}
          {user.department && (
            <div className="text-xs text-gray-500 mt-0.5">{user.department}</div>
          )}
          <div className="text-xs text-gray-500 mt-1">
            <a href={`mailto:${user.email}`} className="text-indigo-600 hover:underline">{user.email}</a>
            {user.phone && <> · <a href={`tel:${user.phone}`} className="text-indigo-600 hover:underline">{user.phone}</a></>}
          </div>
        </div>
      </div>

      {user.bio && (
        <Section title="About">
          <p className="whitespace-pre-wrap">{user.bio}</p>
        </Section>
      )}

      <Section title="Skills">
        <Chips items={user.skills} />
      </Section>

      <Section title="Expertise & Knowledge">
        <Chips items={user.expertise} />
      </Section>

      {(user.location || user.timezone) && (
        <Section title="Where">
          <div className="flex items-center gap-3">
            {user.location && <span>📍 {user.location}</span>}
            {user.timezone && <span className="text-gray-500">🕓 {user.timezone}</span>}
          </div>
        </Section>
      )}

      {(user.linkedinUrl || user.githubUrl) && (
        <Section title="Links">
          <div className="flex gap-3">
            {user.linkedinUrl && (
              <a href={user.linkedinUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                LinkedIn
              </a>
            )}
            {user.githubUrl && (
              <a href={user.githubUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                GitHub
              </a>
            )}
          </div>
        </Section>
      )}
    </div>
  )
}
