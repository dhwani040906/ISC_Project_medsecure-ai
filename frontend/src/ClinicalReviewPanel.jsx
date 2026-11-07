import { useEffect, useState } from 'react'
import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api' })
export default function ClinicalReviewPanel({ predictionId, token }) {
  const [reviews, setReviews] = useState([])
  const [comments, setComments] = useState('')
  const [status, setStatus] = useState('reviewed')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    setReviews([]); setError(''); setNotice('')
    if (!predictionId || !token) return () => { active = false }
    api.get(`/clinical-reviews/predictions/${predictionId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (active) setReviews(r.data) })
      .catch(() => { if (active) setError('Unable to load clinical reviews.') })
    return () => { active = false }
  }, [predictionId, token])
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      const response = await api.post(`/clinical-reviews/predictions/${predictionId}`, { status, comments }, { headers: { Authorization: `Bearer ${token}` } })
      setReviews(old => [response.data, ...old]); setComments(''); setNotice('Review saved.')
    } catch (e) { setError(e.response?.data?.detail || 'Could not save review.') }
    finally { setBusy(false) }
  }
  if (!predictionId) return null
  return <section className="doctor-panel" aria-label="Physician review">
    <h4>Physician review</h4>
    <p className="doctor-muted">Physician notes are separate from AI predictions and previously signed research PDFs.</p>
    {reviews.map(r => <div className="doctor-item" key={r.id}><div><strong>{r.status === 'finalized' ? 'Finalized review' : 'Reviewed'}</strong><small>{r.doctor_name || 'Doctor'} · {new Date(r.created_at).toLocaleString()}</small><p style={{whiteSpace:'pre-wrap'}}>{r.comments}</p></div></div>)}
    {!reviews.length && <p className="doctor-muted">No physician reviews recorded.</p>}
    <form onSubmit={submit} className="doctor-profile">
      <label>Review status<select value={status} onChange={e => setStatus(e.target.value)}><option value="reviewed">Reviewed</option><option value="finalized">Finalized</option></select></label>
      <label>Clinical comments<textarea required minLength={3} maxLength={4000} rows={4} value={comments} onChange={e => setComments(e.target.value)} /></label>
      <button className="doctor-primary" disabled={busy || !comments.trim()}>{busy ? 'Saving…' : 'Save physician review'}</button>
    </form>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
  </section>
}
