import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { User } from '../../lib/types'
import Button from '../ui/Button'

interface ProfileFormProps {
  user: User
  onSaved: (updated: User) => void
}

interface FormState {
  name: string
  avatarUrl: string
  title: string
  department: string
  bio: string
  skills: string
  expertise: string
  phone: string
  location: string
  timezone: string
  linkedinUrl: string
  githubUrl: string
}

function toForm(u: User): FormState {
  return {
    name: u.name ?? '',
    avatarUrl: u.avatarUrl ?? '',
    title: u.title ?? '',
    department: u.department ?? '',
    bio: u.bio ?? '',
    skills: (u.skills ?? []).join(', '),
    expertise: (u.expertise ?? []).join(', '),
    phone: u.phone ?? '',
    location: u.location ?? '',
    timezone: u.timezone ?? '',
    linkedinUrl: u.linkedinUrl ?? '',
    githubUrl: u.githubUrl ?? '',
  }
}

function toPayload(f: FormState) {
  const tokenize = (s: string) =>
    s.split(',').map((t) => t.trim()).filter(Boolean)
  const clean = (v: string) => (v.trim() === '' ? null : v.trim())
  return {
    name: f.name.trim() || undefined,
    avatarUrl: clean(f.avatarUrl),
    title: clean(f.title),
    department: clean(f.department),
    bio: clean(f.bio),
    skills: tokenize(f.skills),
    expertise: tokenize(f.expertise),
    phone: clean(f.phone),
    location: clean(f.location),
    timezone: clean(f.timezone),
    linkedinUrl: clean(f.linkedinUrl),
    githubUrl: clean(f.githubUrl),
  }
}

function Field({
  label, children, hint,
}: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="text-[11px] text-gray-400 mt-0.5 block">{hint}</span>}
    </label>
  )
}

const inputClass = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none'

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
        <Field label="Job Title">
          <input className={inputClass} value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="Senior Software Engineer" />
        </Field>
        <Field label="Department">
          <input className={inputClass} value={form.department} onChange={(e) => update('department', e.target.value)} placeholder="Engineering" />
        </Field>
      </div>

      <Field label="Bio / About" hint="What do you do? What are you working on?">
        <textarea
          className={`${inputClass} min-h-[90px]`}
          value={form.bio}
          onChange={(e) => update('bio', e.target.value)}
          placeholder="Tell your team a bit about yourself…"
        />
      </Field>

      <Field label="Skills" hint="Comma-separated. e.g. React, TypeScript, Prisma, Figma">
        <input className={inputClass} value={form.skills} onChange={(e) => update('skills', e.target.value)} />
      </Field>

      <Field label="Expertise & Knowledge" hint="Areas you know deeply. e.g. OAuth, Payments, Travel APIs">
        <input className={inputClass} value={form.expertise} onChange={(e) => update('expertise', e.target.value)} />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Phone">
          <input className={inputClass} value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+34 …" />
        </Field>
        <Field label="Location">
          <input className={inputClass} value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="Barcelona, Spain" />
        </Field>
        <Field label="Timezone" hint="IANA format">
          <input className={inputClass} value={form.timezone} onChange={(e) => update('timezone', e.target.value)} placeholder="Europe/Madrid" />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="LinkedIn URL">
          <input className={inputClass} value={form.linkedinUrl} onChange={(e) => update('linkedinUrl', e.target.value)} placeholder="https://linkedin.com/in/…" />
        </Field>
        <Field label="GitHub URL">
          <input className={inputClass} value={form.githubUrl} onChange={(e) => update('githubUrl', e.target.value)} placeholder="https://github.com/…" />
        </Field>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

      <div className="flex items-center justify-end gap-2">
        {saved && <span className="text-xs text-emerald-600">Saved ✓</span>}
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
      </div>
    </form>
  )
}
