import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import ProfileView from '../components/profile/ProfileView'
import ProfileForm from '../components/profile/ProfileForm'
import type { User } from '../lib/types'

export default function Profile() {
  const { userId } = useParams<{ userId: string }>()
  const { user: me, fetchMe } = useAuthStore()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const targetId = userId ?? me?.id ?? ''
  const isMe = !!me && targetId === me.id

  useEffect(() => {
    if (!targetId) return
    setLoading(true)
    api.get<User>(`/api/users/${targetId}`)
      .then((u) => setUser(u))
      .catch((err) => setError(err?.message ?? 'Failed to load profile'))
      .finally(() => setLoading(false))
  }, [targetId])

  if (loading) return <div className="p-8 text-text-secondary">Loading…</div>
  if (error) return <div className="p-8 text-danger">{error}</div>
  if (!user) return null

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="bg-surface rounded-lg border border-border p-6">
        {isMe ? (
          <>
            <h1 className="text-xl font-bold mb-4">Your Profile</h1>
            <ProfileForm
              user={user}
              onSaved={(u) => { setUser(u); fetchMe() }}
            />
          </>
        ) : (
          <ProfileView user={user} />
        )}
      </div>
    </div>
  )
}
