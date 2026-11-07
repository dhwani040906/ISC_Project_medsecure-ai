import { useState } from 'react'
import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api', timeout: 15000 })

export default function AccountSettings({ token, onPasswordChanged }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (newPassword !== confirmation) { setError('New passwords do not match.'); return }
    if (newPassword === currentPassword) { setError('Choose a different password.'); return }
    setBusy(true)
    try {
      await api.patch('/auth/me/password', { current_password: currentPassword, new_password: newPassword }, { headers: { Authorization: `Bearer ${token}` } })
      setCurrentPassword(''); setNewPassword(''); setConfirmation('')
      onPasswordChanged()
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Password could not be changed. Please try again.')
    } finally { setBusy(false) }
  }

  return <section style={{ maxWidth: 560, background: '#fff', padding: 24, border: '1px solid #e2e8f0', borderRadius: 14 }}>
    <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Password and account security</h3>
    <p style={{ color: '#64748b', marginBottom: 20 }}>Changing your password signs you out of all sessions. Sign in again using your new password.</p>
    <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
      <label style={{ display: 'grid', gap: 6 }}>Current password
        <input type="password" required autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={inputStyle} />
      </label>
      <label style={{ display: 'grid', gap: 6 }}>New password (minimum 12 characters)
        <input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={inputStyle} />
      </label>
      <label style={{ display: 'grid', gap: 6 }}>Confirm new password
        <input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} style={inputStyle} />
      </label>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      <button type="submit" disabled={busy} style={{ background: '#0f766e', color: 'white', padding: '12px 18px', borderRadius: 8, opacity: busy ? .6 : 1, cursor: 'pointer' }}>{busy ? 'Updating password…' : 'Change password'}</button>
    </form>
  </section>
}
const inputStyle = { border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 12px', width: '100%' }
