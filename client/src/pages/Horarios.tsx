import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import { darkenForContrast } from '../components/columns/colors'
import type { Roster, ShiftTemplate, ShiftAssignment, ShiftStatus } from '../lib/types'

// ── Date helpers (Monday-start weeks, local time) ────────────────────────────────
function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
function mondayOf(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (r.getDay() + 6) % 7 // 0 = Monday
  return addDays(r, -dow)
}
const DOW = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
const fmtDay = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })

// ── Status chip styling ──────────────────────────────────────────────────────────
const STATUS_META: Record<Exclude<ShiftStatus, 'WORKING'>, { label: string; color: string }> = {
  OFF:      { label: 'Libra',      color: '#5a5f7a' },
  VACATION: { label: 'Vacaciones', color: '#00a3bf' },
  SICK:     { label: 'Baja',       color: '#e2445c' },
}

export default function Horarios() {
  const { currentOrgId } = useAuthStore()
  const [departments, setDepartments] = useState<string[]>([])
  const [department, setDepartment] = useState<string | null>(null)
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()))
  const [roster, setRoster] = useState<Roster | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null) // `${userId}|${ymd}`
  const [seeding, setSeeding] = useState(false)

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const todayYMD = toYMD(new Date())

  // Departments
  useEffect(() => {
    if (!currentOrgId) return
    api.get<string[]>(`/api/schedules/departments?orgId=${currentOrgId}`).then((deps) => {
      setDepartments(deps)
      setDepartment((d) => d ?? deps[0] ?? null)
    })
  }, [currentOrgId])

  // Roster for the visible week + department
  const refresh = async () => {
    if (!currentOrgId || !department) { setRoster(null); setLoading(false); return }
    setLoading(true)
    try {
      const from = toYMD(weekDates[0])
      const to = toYMD(weekDates[6])
      const r = await api.get<Roster>(
        `/api/schedules/roster?orgId=${currentOrgId}&department=${encodeURIComponent(department)}&from=${from}&to=${to}`,
      )
      setRoster(r)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { refresh() }, [currentOrgId, department, weekStart])

  // Fast lookup: `${userId}|${ymd}` → assignment
  const byCell = useMemo(() => {
    const m = new Map<string, ShiftAssignment>()
    roster?.assignments.forEach((a) => m.set(`${a.userId}|${a.date.slice(0, 10)}`, a))
    return m
  }, [roster])
  const templateById = useMemo(() => {
    const m = new Map<string, ShiftTemplate>()
    roster?.templates.forEach((t) => m.set(t.id, t))
    return m
  }, [roster])

  const setAssignment = async (
    userId: string, ymd: string,
    patch: { templateId?: string | null; status?: ShiftStatus } | null,
  ) => {
    if (!currentOrgId) return
    setEditing(null)
    if (patch === null) {
      // optimistic clear
      setRoster((r) => r && { ...r, assignments: r.assignments.filter((a) => !(a.userId === userId && a.date.slice(0, 10) === ymd)) })
      await api.delete(`/api/schedules/assignments?orgId=${currentOrgId}&userId=${userId}&date=${ymd}`)
      return
    }
    const saved = await api.put<ShiftAssignment>('/api/schedules/assignments', {
      orgId: currentOrgId, userId, date: ymd, ...patch,
    })
    setRoster((r) => {
      if (!r) return r
      const rest = r.assignments.filter((a) => !(a.userId === userId && a.date.slice(0, 10) === ymd))
      return { ...r, assignments: [...rest, saved] }
    })
  }

  const seedDefaults = async () => {
    if (!currentOrgId || !department) return
    setSeeding(true)
    try {
      const templates = await api.post<ShiftTemplate[]>('/api/schedules/templates/seed-defaults', {
        orgId: currentOrgId, department,
      })
      setRoster((r) => (r ? { ...r, templates } : r))
    } finally {
      setSeeding(false)
    }
  }

  if (!currentOrgId) {
    return <div className="p-8 text-sm text-text-secondary">No hay organización seleccionada.</div>
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold">Horarios</h1>
          <p className="text-sm text-text-secondary mt-0.5">Cuadrante de turnos por departamento</p>
        </div>
        <div className="flex items-center gap-2">
          {departments.length > 0 && (
            <select
              value={department ?? ''}
              onChange={(e) => setDepartment(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-sm outline-none"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-soft)', color: 'var(--text-primary)' }}
            >
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-soft)' }}>
            <button onClick={() => setWeekStart((w) => addDays(w, -7))} className="px-2.5 py-1.5 text-text-muted hover:bg-surface-hover">‹</button>
            <button onClick={() => setWeekStart(mondayOf(new Date()))} className="px-3 py-1.5 text-sm text-text-primary hover:bg-surface-hover">Hoy</button>
            <button onClick={() => setWeekStart((w) => addDays(w, 7))} className="px-2.5 py-1.5 text-text-muted hover:bg-surface-hover">›</button>
          </div>
        </div>
      </div>

      {loading && <div className="text-sm text-text-secondary py-12 text-center">Cargando…</div>}

      {!loading && !department && (
        <div className="text-sm text-text-secondary py-12 text-center">
          Ningún usuario tiene departamento asignado todavía.
        </div>
      )}

      {!loading && department && roster && roster.templates.length === 0 && (
        <div className="rounded-xl p-6 text-center" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-soft)' }}>
          <p className="text-sm text-text-secondary mb-3">
            <span className="font-semibold text-text-primary">{department}</span> no tiene plantillas de turno.
          </p>
          <Button onClick={seedDefaults} disabled={seeding}>
            {seeding ? 'Creando…' : 'Crear plantillas por defecto'}
          </Button>
        </div>
      )}

      {!loading && department && roster && roster.templates.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-soft)', backgroundColor: 'var(--surface)' }}>
          {/* Day header row */}
          <div className="grid" style={{ gridTemplateColumns: '200px repeat(7, 1fr)' }}>
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted" style={{ borderBottom: '1px solid var(--border-soft)' }}>
              Persona
            </div>
            {weekDates.map((d, i) => {
              const isToday = toYMD(d) === todayYMD
              return (
                <div
                  key={i}
                  className="px-2 py-2 text-center"
                  style={{ borderBottom: '1px solid var(--border-soft)', borderLeft: '1px solid var(--border-soft)', backgroundColor: isToday ? 'var(--accent-soft)' : undefined }}
                >
                  <div className="text-[11px] uppercase text-text-muted">{DOW[i]}</div>
                  <div className={`text-sm ${isToday ? 'text-accent font-semibold' : 'text-text-primary'}`}>{fmtDay.format(d)}</div>
                </div>
              )
            })}
          </div>

          {/* Person rows */}
          {roster.users.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-text-secondary">Sin personas en este departamento.</div>
          )}
          {roster.users.map((u) => (
            <div key={u.id} className="grid items-stretch" style={{ gridTemplateColumns: '200px repeat(7, 1fr)' }}>
              <div className="px-3 py-2 flex items-center gap-2 min-w-0" style={{ borderTop: '1px solid var(--border-soft)' }}>
                <Avatar name={u.name} src={u.avatarUrl} size="sm" />
                <span className="text-sm text-text-primary truncate">{u.name}</span>
              </div>
              {weekDates.map((d, i) => {
                const ymd = toYMD(d)
                const key = `${u.id}|${ymd}`
                const a = byCell.get(key)
                const tpl = a?.templateId ? templateById.get(a.templateId) : undefined
                return (
                  <div
                    key={i}
                    className="relative px-1.5 py-1.5 flex items-center justify-center"
                    style={{ borderTop: '1px solid var(--border-soft)', borderLeft: '1px solid var(--border-soft)' }}
                  >
                    <button
                      onClick={() => setEditing((e) => (e === key ? null : key))}
                      className="w-full h-full min-h-[34px] flex items-center justify-center rounded-md transition hover:bg-surface-hover"
                    >
                      {a && a.status === 'WORKING' && tpl ? (
                        <span
                          className="block w-full text-center text-[11px] font-semibold text-white rounded-full px-2 py-1 leading-tight"
                          style={{ backgroundColor: darkenForContrast(tpl.color) }}
                          title={tpl.segments.map((s) => `${s.start}–${s.end}`).join('  ')}
                        >
                          {tpl.label}
                        </span>
                      ) : a && a.status !== 'WORKING' ? (
                        <span
                          className="block text-[11px] font-medium rounded-full px-2.5 py-1"
                          style={{ color: STATUS_META[a.status].color, border: `1px dashed ${STATUS_META[a.status].color}` }}
                        >
                          {STATUS_META[a.status].label}
                        </span>
                      ) : (
                        <span className="text-text-muted opacity-0 group-hover:opacity-100">+</span>
                      )}
                    </button>

                    {editing === key && (
                      <CellEditor
                        templates={roster.templates}
                        onPick={(patch) => setAssignment(u.id, ymd, patch)}
                        onClose={() => setEditing(null)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          {/* Coverage row */}
          <div className="grid" style={{ gridTemplateColumns: '200px repeat(7, 1fr)', backgroundColor: 'var(--surface-hover)' }}>
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted" style={{ borderTop: '1px solid var(--border-soft)' }}>
              Cobertura
            </div>
            {weekDates.map((d, i) => {
              const ymd = toYMD(d)
              const working = roster.users.filter((u) => byCell.get(`${u.id}|${ymd}`)?.status === 'WORKING').length
              return (
                <div key={i} className="px-2 py-2 text-center text-sm font-semibold text-text-primary" style={{ borderTop: '1px solid var(--border-soft)', borderLeft: '1px solid var(--border-soft)' }}>
                  {working}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Cell editor popover ──────────────────────────────────────────────────────────
function CellEditor({
  templates, onPick, onClose,
}: {
  templates: ShiftTemplate[]
  onPick: (patch: { templateId?: string | null; status?: ShiftStatus } | null) => void
  onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 w-52 rounded-xl py-1.5"
        style={{ backgroundColor: 'var(--popover-bg)', border: '1px solid var(--popover-border)', boxShadow: 'var(--popover-shadow)' }}
      >
        <div className="px-3 pt-1 pb-1 text-[10px] uppercase tracking-wide text-text-muted">Turno</div>
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => onPick({ status: 'WORKING', templateId: t.id })}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-text-primary hover:bg-surface-hover"
          >
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: darkenForContrast(t.color) }} />
            <span className="truncate">{t.label}</span>
          </button>
        ))}
        <div className="mx-3 my-1 h-px" style={{ backgroundColor: 'var(--border-soft)' }} />
        {(['OFF', 'VACATION', 'SICK'] as const).map((s) => (
          <button
            key={s}
            onClick={() => onPick({ status: s })}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-surface-hover"
            style={{ color: STATUS_META[s].color }}
          >
            {STATUS_META[s].label}
          </button>
        ))}
        <div className="mx-3 my-1 h-px" style={{ backgroundColor: 'var(--border-soft)' }} />
        <button onClick={() => onPick(null)} className="w-full px-3 py-1.5 text-left text-sm text-text-muted hover:bg-surface-hover">
          Limpiar
        </button>
      </div>
    </>
  )
}
