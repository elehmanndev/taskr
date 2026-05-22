import { useEffect, useState, useRef } from 'react'
import { api } from '../../lib/api'
import type { User, LanguageCode, LanguageLevel } from '../../lib/types'
import Button from '../ui/Button'

interface ProfileFormProps {
  user: User
  onSaved: (updated: User) => void
}

const LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: 'es', label: 'Spanish' },
  { code: 'ca', label: 'Catalan' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
]

const LEVEL_LABELS: Record<LanguageLevel, string> = {
  1: 'Native',
  2: 'Fluent',
  3: 'Intermediate',
  4: 'Basic',
}

interface FormState {
  name: string
  avatarUrl: string
  department: string
  group: string
  claudeMd: string
  expertise: string[]
  languages: Partial<Record<LanguageCode, LanguageLevel>>
  slackUrl: string
}

function toForm(u: User): FormState {
  return {
    name: u.name ?? '',
    avatarUrl: u.avatarUrl ?? '',
    department: u.department ?? '',
    group: u.group ?? '',
    claudeMd: u.claudeMd ?? '',
    expertise: u.expertise ?? [],
    languages: u.languages ?? {},
    slackUrl: u.slackUrl ?? '',
  }
}

function toPayload(f: FormState) {
  const clean = (v: string) => (v.trim() === '' ? null : v.trim())
  return {
    name: f.name.trim() || undefined,
    avatarUrl: clean(f.avatarUrl),
    department: clean(f.department),
    group: clean(f.group),
    claudeMd: clean(f.claudeMd),
    expertise: f.expertise,
    languages: f.languages,
    slackUrl: clean(f.slackUrl),
  }
}

function Field({
  label, children, hint,
}: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-text-primary">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="text-[11px] text-text-muted mt-0.5 block">{hint}</span>}
    </label>
  )
}

const inputClass = 'w-full border border-border-strong rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none bg-transparent text-text-primary'

function TagInput({
  values, onChange, placeholder,
}: { values: string[]; onChange: (next: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const commit = (raw: string) => {
    const parts = raw.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.length === 0) return
    const next = [...values]
    for (const p of parts) if (!next.includes(p)) next.push(p)
    onChange(next)
    setDraft('')
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(draft)
    } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  const remove = (s: string) => onChange(values.filter((v) => v !== s))

  return (
    <div
      className="flex flex-wrap gap-1.5 px-2 py-1.5 rounded-md border border-border-strong focus-within:ring-2 focus-within:ring-accent focus-within:border-accent"
      onClick={() => inputRef.current?.focus()}
    >
      {values.map((s) => (
        <span
          key={s}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ color: 'var(--accent)', backgroundColor: 'var(--accent-soft)' }}
        >
          {s}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); remove(s) }}
            className="opacity-70 hover:opacity-100"
            aria-label={`Remove ${s}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm py-0.5 text-text-primary"
        placeholder={values.length === 0 ? placeholder : ''}
      />
    </div>
  )
}

function LanguagesEditor({
  value, onChange,
}: { value: Partial<Record<LanguageCode, LanguageLevel>>; onChange: (next: Partial<Record<LanguageCode, LanguageLevel>>) => void }) {
  const toggle = (code: LanguageCode) => {
    const next = { ...value }
    if (next[code] != null) delete next[code]
    else next[code] = 3
    onChange(next)
  }

  const setLevel = (code: LanguageCode, level: LanguageLevel) => {
    onChange({ ...value, [code]: level })
  }

  return (
    <div className="space-y-1.5">
      {LANGUAGES.map(({ code, label }) => {
        const checked = value[code] != null
        const level = value[code] ?? 3
        return (
          <div key={code} className="flex items-center gap-3">
            <label className="flex items-center gap-2 min-w-[130px] cursor-pointer">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(code)}
                className="rounded border-border-strong text-accent focus:ring-accent"
              />
              <span className="text-sm text-text-primary">{label}</span>
            </label>
            {checked && (
              <div className="flex items-center gap-1.5">
                {([1, 2, 3, 4] as LanguageLevel[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLevel(code, l)}
                    title={LEVEL_LABELS[l]}
                    className={`w-7 h-7 rounded-md text-xs font-semibold transition ${
                      level === l
                        ? 'text-white'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                    style={{
                      backgroundColor: level === l ? 'var(--accent)' : 'var(--surface-glass-strong)',
                      border: '1px solid var(--border-soft)',
                    }}
                  >
                    {l}
                  </button>
                ))}
                <span className="text-[11px] text-text-muted ml-1">{LEVEL_LABELS[level]}</span>
              </div>
            )}
          </div>
        )
      })}
      <div className="text-[11px] text-text-muted">1 = native · 2 = fluent · 3 = intermediate · 4 = basic</div>
    </div>
  )
}

export default function ProfileForm({ user, onSaved }: ProfileFormProps) {
  const [form, setForm] = useState<FormState>(toForm(user))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setForm(toForm(user)) }, [user])

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const updated = await api.patch<User>('/api/users/me', toPayload(form))
      onSaved(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name">
          <input className={inputClass} value={form.name} onChange={(e) => update('name', e.target.value)} />
        </Field>
        <Field label="Avatar URL">
          <input className={inputClass} value={form.avatarUrl} onChange={(e) => update('avatarUrl', e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Department">
          <input className={inputClass} value={form.department} onChange={(e) => update('department', e.target.value)} placeholder="Engineering" />
        </Field>
        <Field label="Group" hint="Sub-department or squad, e.g. Brand, Backend, Growth">
          <input className={inputClass} value={form.group} onChange={(e) => update('group', e.target.value)} placeholder="Brand" />
        </Field>
      </div>

      <Field label="CLAUDE.md" hint="Free-form context about you — what you do, how you work, anything an agent should know.">
        <textarea
          className={`${inputClass} min-h-[140px] font-mono text-[13px]`}
          value={form.claudeMd}
          onChange={(e) => update('claudeMd', e.target.value)}
          placeholder="# About me&#10;&#10;..."
        />
      </Field>

      <Field label="Expertise & Knowledge" hint="Add terms one by one — press Enter or comma to create a tag.">
        <TagInput
          values={form.expertise}
          onChange={(next) => update('expertise', next)}
          placeholder="OAuth, Payments, Travel APIs"
        />
      </Field>

      <Field label="Languages">
        <LanguagesEditor value={form.languages} onChange={(next) => update('languages', next)} />
      </Field>

      <Field label="Slack profile" hint="Paste the link to your Slack profile (right-click your name → Copy link).">
        <input className={inputClass} value={form.slackUrl} onChange={(e) => update('slackUrl', e.target.value)} placeholder="https://yourworkspace.slack.com/team/U…" />
      </Field>

      {error &&<div className="text-sm text-danger bg-surface border border-danger rounded-md px-3 py-2">{error}</div>}

      <div className="flex items-center justify-end gap-2">
        {saved && <span className="text-xs text-emerald-600">Saved ✓</span>}
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
      </div>
    </form>
  )
}
