import AdminWorkspace from './AdminWorkspace'
import DoctorWorkspace from './DoctorWorkspace'
import PatientWorkspace from './PatientWorkspace'
import './patient.css'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { ShieldCheck, Activity, Database, LockKeyhole, ScanLine, LogOut, UserPlus } from 'lucide-react'

// Match the Phase 1 variable, including the /api suffix.
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api', timeout: 10000 })

function StatusCard({ icon: Icon, title, value, note }) {
  return <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
    <Icon className="text-teal-600 mb-4" size={28}/><h2 className="font-semibold text-lg">{title}</h2>
    <p className="font-bold text-xl mt-2">{value}</p><p className="text-slate-500 text-sm mt-2">{note}</p>
  </div>
}

export default function Portal() {
  const [searchParams] = useSearchParams()
  const [apiStatus, setApiStatus] = useState('Checking…')
  const [dbStatus, setDbStatus] = useState('Checking…')
  const [token, setToken] = useState(null) // Memory only: refresh requires login again
  const [user, setUser] = useState(null)
  const [mode, setMode] = useState(searchParams.get('mode') === 'register' ? 'register' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [profileName, setProfileName] = useState('')
  const [profileUsername, setProfileUsername] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [dashboard, setDashboard] = useState(null)
  const [doctorEmail, setDoctorEmail] = useState('')
  const [doctorPassword, setDoctorPassword] = useState('')
  const [doctorLicense, setDoctorLicense] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [doctorUsername, setDoctorUsername] = useState('')
  const [images, setImages] = useState([])
  const [analysisResult, setAnalysisResult] = useState(null)
  const [analyzingId, setAnalyzingId] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [doctors, setDoctors] = useState([])
  const [selectedDoctor, setSelectedDoctor] = useState('')
  const [auditEvents, setAuditEvents] = useState([])
  const [auditSummary, setAuditSummary] = useState(null)
  const [auditVerification, setAuditVerification] = useState(null)
  const [auditFilter, setAuditFilter] = useState('')
  const [auditError, setAuditError] = useState('')
  const [reports, setReports] = useState([])
  const [selectedPrediction, setSelectedPrediction] = useState('')
  const [reportBusy, setReportBusy] = useState(false)
  const loadImages = async (accessToken) => {
    const h = { Authorization: `Bearer ${accessToken}` }
    setImages((await api.get('/images', { headers: h })).data)
  }
  const uploadImage = async (event) => {
    event.preventDefault(); if (!imageFile) return
    setBusy(true); setMessage(''); setUploadProgress(0)
    try {
      const form = new FormData(); form.append('file', imageFile)
      await api.post('/images', form, { headers: authHeaders, timeout: 30000, onUploadProgress: e => { if (e.total) setUploadProgress(Math.round(e.loaded * 100 / e.total)) } })
      await loadImages(token); setImageFile(null); event.target.reset()
      setMessage('X-ray encrypted and uploaded.')
    } catch (err) { setMessage(errorMessage(err)) } finally { setBusy(false); setUploadProgress(null) }
  }
  const downloadImage = async (id) => {
    try {
      const result = await api.get(`/images/${id}/download`, { headers: authHeaders, responseType: 'blob' })
      const url = URL.createObjectURL(result.data)
      const a = document.createElement('a'); a.href = url; a.download = `xray-${id}.${result.data.type === 'image/png' ? 'png' : 'jpg'}`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) { setMessage('Unable to download image. Check access and integrity.') }
  }
  const analyzeXray = async (id) => {
    setAnalyzingId(id); setAnalysisResult(null); setMessage('')
    try {
      const response = await api.post(`/analysis/${id}`, {}, { headers: authHeaders, timeout: 120000 })
      setAnalysisResult({ ...response.data, imageId: id })
      setSelectedPrediction(''); setReports([])
      setMessage('Research model analysis completed. This is not a medical diagnosis.')
    } catch (err) { setMessage(errorMessage(err)) }
    finally { setAnalyzingId(null) }
  }
  const fetchReports = async (predictionId) => {
    const response = await api.get(`/reports/predictions/${predictionId}`, { headers: authHeaders })
    setReports(response.data)
  }
  const loadPredictionHistory = async (imageId) => {
    setMessage('')
    try {
      const result = await api.get(`/analysis/${imageId}/history`, { headers: authHeaders })
      if (result.data.length === 0) { setMessage('Analyze this image first.'); return }
      setSelectedPrediction(result.data[0].id)
      await fetchReports(result.data[0].id)
    } catch (err) { setMessage(errorMessage(err)) }
  }
  const createReport = async () => {
    if (!selectedPrediction) return
    setReportBusy(true); setMessage('')
    try {
      const result = await api.post(`/reports/predictions/${selectedPrediction}`, {}, { headers: authHeaders, timeout: 30000 })
      await fetchReports(selectedPrediction)
      setMessage(`Signed encrypted research report created: ${result.data.id}`)
    } catch (err) { setMessage(errorMessage(err)) }
    finally { setReportBusy(false) }
  }
  const verifyReport = async (id) => {
    try {
      const result = await api.get(`/reports/${id}/verify`, { headers: authHeaders })
      setMessage(result.data.verified ? 'Report SHA-256 integrity and RSA-PSS signature verified.' : 'WARNING: Report verification failed. Do not use this report.')
    } catch (err) { setMessage(errorMessage(err)) }
  }
  const downloadReport = async (id) => {
    try {
      const result = await api.get(`/reports/${id}/download`, { headers: authHeaders, responseType: 'blob', timeout: 30000 })
      const url = URL.createObjectURL(result.data)
      const link = document.createElement('a'); link.href = url; link.download = `research-report-${id}.pdf`; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) { setMessage('Report download failed or integrity verification failed.') }
  }
  const grantDoctor = async () => {
    if (!selectedDoctor) return
    try { await api.post(`/images/permissions/${selectedDoctor}`, {}, { headers: authHeaders }); setMessage('Doctor access granted.') }
    catch (err) { setMessage(errorMessage(err)) }
  }

  useEffect(() => {
    api.get('/health').then(() => setApiStatus('Connected')).catch(() => setApiStatus('Unavailable'))
    api.get('/health/database').then(() => setDbStatus('Connected')).catch(() => setDbStatus('Unavailable'))
  }, [])

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}
  const errorMessage = (err) => {
    const detail = err.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (err.response?.status === 422) return 'Please check your email and password (minimum 12 characters for registration).'
    return 'Request failed. Check the backend and try again.'
  }
  const fetchDashboard = async (role, accessToken) => {
    const endpoint = role === 'admin' ? '/admin/dashboard' : role === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard'
    const result = await api.get(endpoint, { headers: { Authorization: `Bearer ${accessToken}` } })
    setDashboard(result.data)
  }
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      if (mode === 'register') {
        await api.post('/auth/register', { email, password, full_name: fullName, username })
        setMessage('Registration successful. Sign in to continue.')
        setMode('login'); setPassword('')
      } else {
        const response = await api.post('/auth/login', { email, password })
        setToken(response.data.access_token)
        setUser(response.data.user)
        setProfileName(response.data.user.full_name || '')
        setProfileUsername(response.data.user.username || '')
        setPassword('')
        await fetchDashboard(response.data.user.role, response.data.access_token)
        if (response.data.user.role !== 'admin') await loadImages(response.data.access_token)
        if (response.data.user.role === 'patient') {
          const directory = await api.get('/images/permissions/doctors', { headers: { Authorization: `Bearer ${response.data.access_token}` } })
          setDoctors(directory.data)
        }
      }
    } catch (err) { setMessage(errorMessage(err)) }
    finally { setBusy(false) }
  }
  const logout = async () => {
    try { if (token) await api.post('/auth/logout', {}, { headers: authHeaders }) }
    catch (err) { setMessage('Logout request failed; the server session may remain active until expiry.') }
    finally { setToken(null); setUser(null); setDashboard(null); setImages([]); setAnalysisResult(null); setDoctors([]); setPassword(''); setReports([]); setSelectedPrediction('') }
  }
  const createDoctor = async (event) => {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      await api.post('/auth/doctors', { email: doctorEmail, password: doctorPassword, full_name: doctorName, username: doctorUsername, license_reference: doctorLicense || null }, { headers: authHeaders })
      setMessage('Doctor account created successfully.')
      setDoctorEmail(''); setDoctorPassword(''); setDoctorLicense(''); setDoctorName(''); setDoctorUsername('')
      await fetchDashboard('admin', token)
    } catch (err) { setMessage(errorMessage(err)) }
    finally { setBusy(false) }
  }

  const saveProfile = async (event) => {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const result = await api.patch('/auth/me/profile', { full_name: profileName, username: profileUsername }, { headers: authHeaders })
      setUser(result.data); setMessage('Profile updated. Newly generated reports will use this information.')
    } catch (err) { setMessage(errorMessage(err)) }
    finally { setBusy(false) }
  }
  const loadAudit = async () => {
    setAuditError('')
    try {
      const [summary, events, verify] = await Promise.all([
        api.get('/audit/summary', { headers: authHeaders }),
        api.get('/audit/events', { headers: authHeaders, params: { limit: 50, ...(auditFilter ? { event_type: auditFilter } : {}) } }),
        api.get('/audit/verify', { headers: authHeaders }),
      ])
      setAuditSummary(summary.data); setAuditEvents(events.data); setAuditVerification(verify.data)
    } catch (err) { setAuditError(errorMessage(err)) }
  }

  return <div className="min-h-screen">
    <header className="bg-[#102a47] text-white px-6 py-5"><div className="max-w-6xl mx-auto flex items-center gap-3">
      <ShieldCheck size={30} className="text-teal-300"/><Link to="/" className="font-bold text-xl">MedSecure AI</Link>
      <Link to="/" className="ml-auto text-sm text-slate-300 hover:text-white">Back to website</Link>
      {user && <button onClick={logout} className="ml-4 flex items-center gap-2 text-sm bg-slate-700 rounded-lg px-3 py-2"><LogOut size={16}/> Logout</button>}
    </div></header>
    <main className="max-w-6xl mx-auto px-6 py-10">
      <p className="text-teal-700 font-semibold">YOUR SECURE WORKSPACE</p>
      <h1 className="text-3xl font-bold mt-2">MedSecure AI Portal</h1>
      <p className="text-slate-600 mt-3 mb-8">Sign in to manage authorized imaging records and reports.</p>
      {user?.role === 'patient' && <PatientWorkspace user={user} images={images} imageFile={imageFile} setImageFile={setImageFile} uploadImage={uploadImage} busy={busy} uploadProgress={uploadProgress} analyzingId={analyzingId} analyzeXray={analyzeXray} analysisResult={analysisResult} downloadImage={downloadImage} loadPredictionHistory={loadPredictionHistory} selectedPrediction={selectedPrediction} reports={reports} reportBusy={reportBusy} createReport={createReport} verifyReport={verifyReport} downloadReport={downloadReport} doctors={doctors} selectedDoctor={selectedDoctor} setSelectedDoctor={setSelectedDoctor} grantDoctor={grantDoctor} profileName={profileName} setProfileName={setProfileName} profileUsername={profileUsername} setProfileUsername={setProfileUsername} saveProfile={saveProfile}/> }
      {user?.role === 'doctor' && <DoctorWorkspace user={user} token={token} images={images} analyzingId={analyzingId} analyzeXray={analyzeXray} analysisResult={analysisResult} downloadImage={downloadImage} loadPredictionHistory={loadPredictionHistory} selectedPrediction={selectedPrediction} reports={reports} reportBusy={reportBusy} createReport={createReport} verifyReport={verifyReport} downloadReport={downloadReport} profileName={profileName} setProfileName={setProfileName} profileUsername={profileUsername} setProfileUsername={setProfileUsername} saveProfile={saveProfile} busy={busy}/> }
      {message && <div role="alert" className="mt-6 bg-white border border-slate-300 rounded-xl p-4 text-slate-700">{message}</div>}
      {!user ? <section className="bg-white rounded-2xl border border-slate-200 p-7 mt-8 max-w-xl">
        <div className="flex gap-3 mb-5">
          <button onClick={() => { setMode('login'); setMessage('') }} className={`rounded-lg px-4 py-2 ${mode === 'login' ? 'bg-teal-700 text-white' : 'bg-slate-100'}`}>Sign in</button>
          <button onClick={() => { setMode('register'); setMessage('') }} className={`rounded-lg px-4 py-2 ${mode === 'register' ? 'bg-teal-700 text-white' : 'bg-slate-100'}`}>Patient registration</button>
        </div>
        <h2 className="font-semibold text-xl mb-4">{mode === 'login' ? 'Account login' : 'Register as patient'}</h2>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm">Email<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="block w-full mt-1 p-3 border rounded-lg"/></label>
          {mode === 'register' && <>
            <label className="block text-sm">Full name<input required minLength={2} maxLength={120} value={fullName} onChange={e => setFullName(e.target.value)} className="block w-full mt-1 p-3 border rounded-lg"/></label>
            <label className="block text-sm">Username<input required pattern="[A-Za-z][A-Za-z0-9_.-]{2,39}" value={username} onChange={e => setUsername(e.target.value)} className="block w-full mt-1 p-3 border rounded-lg"/></label>
          </>}
          <label className="block text-sm">Password<input type="password" required minLength={mode === 'register' ? 12 : undefined} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} className="block w-full mt-1 p-3 border rounded-lg"/></label>
          <button disabled={busy} className="bg-teal-700 disabled:opacity-50 text-white rounded-lg px-5 py-3">{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create patient account'}</button>
        </form>
        <p className="text-sm text-slate-500 mt-4">Doctor accounts are created by an administrator. Admin accounts are provisioned through the backend CLI.</p>
      </section> : user.role === 'admin' ? <AdminWorkspace user={user} dashboard={dashboard} apiStatus={apiStatus} dbStatus={dbStatus} auditEvents={auditEvents} auditSummary={auditSummary} auditVerification={auditVerification} auditFilter={auditFilter} setAuditFilter={setAuditFilter} auditError={auditError} loadAudit={loadAudit} doctorName={doctorName} setDoctorName={setDoctorName} doctorUsername={doctorUsername} setDoctorUsername={setDoctorUsername} doctorEmail={doctorEmail} setDoctorEmail={setDoctorEmail} doctorPassword={doctorPassword} setDoctorPassword={setDoctorPassword} doctorLicense={doctorLicense} setDoctorLicense={setDoctorLicense} createDoctor={createDoctor} busy={busy} /> : null}
      </main>
  </div>
}
