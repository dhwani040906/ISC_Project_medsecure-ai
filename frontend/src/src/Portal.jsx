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
      {user?.role === 'admin' && <div className="grid md:grid-cols-3 gap-5">
        <StatusCard icon={Activity} title="FastAPI Backend" value={apiStatus} note="GET /api/health"/>
        <StatusCard icon={Database} title="PostgreSQL" value={dbStatus} note="GET /api/health/database"/>
        <StatusCard icon={LockKeyhole} title="Authentication" value={user ? 'Signed in' : 'Ready'} note="Account access"/>
      </div>}
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
      </section> : user.role === 'admin' ? <section className="bg-white rounded-2xl border border-slate-200 p-7 mt-8">
        <h2 className="font-semibold text-xl">{user.role.charAt(0).toUpperCase() + user.role.slice(1)} dashboard</h2>
        <p className="text-slate-600 mt-2">{user.full_name || 'Name not provided'} · @{user.username || 'username-not-set'} · {user.email}</p>
        {(user.role === 'patient' || user.role === 'doctor') && <form onSubmit={saveProfile} className="mt-5 p-4 rounded-xl border space-y-3 max-w-xl" aria-label="My profile">
          <h3 className="font-semibold">My profile</h3>
          <p className="text-sm text-slate-500">Update your name and username. Existing signed reports cannot be changed.</p>
          <label className="block text-sm">Full name<input required minLength={2} maxLength={120} value={profileName} onChange={e => setProfileName(e.target.value)} className="block w-full mt-1 p-2 border rounded-lg"/></label>
          <label className="block text-sm">Username<input required pattern="[A-Za-z][A-Za-z0-9_.-]{2,39}" value={profileUsername} onChange={e => setProfileUsername(e.target.value)} className="block w-full mt-1 p-2 border rounded-lg"/></label>
          <button disabled={busy} className="bg-teal-700 text-white rounded-lg px-4 py-2">Save profile</button>
        </form>}
        {dashboard && <div className="bg-slate-50 rounded-lg p-4 mt-5 space-y-2">
          {Object.entries(dashboard).map(([key, value]) => <p key={key}><strong>{key.replaceAll('_',' ')}:</strong> {String(value)}</p>)}
        </div>}
        {user.role !== 'admin' && <div className="mt-8 border-t pt-6 space-y-4">
          <h3 className="font-semibold text-lg">Encrypted chest X-rays</h3>
          <p className="text-sm text-slate-600">PNG/JPEG, maximum 10 MiB. Images are encrypted before storage. Use synthetic images for development.</p>
          {user.role === 'patient' && <form onSubmit={uploadImage} className="flex flex-wrap items-center gap-3">
            <input aria-label="X-ray image" type="file" accept="image/png,image/jpeg" required onChange={e => setImageFile(e.target.files?.[0] || null)}/>
            <button disabled={busy || !imageFile} className="bg-teal-700 text-white px-4 py-2 rounded-lg disabled:opacity-50">Encrypt & upload</button>
          </form>}
          <div className="space-y-2">{images.length === 0 ? <p className="text-slate-500">No accessible images yet.</p> : images.map(img => <div key={img.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-lg p-3"><span className="text-sm">{img.reference || `XR-${img.id.replaceAll('-', '').slice(0, 12).toUpperCase()}`} · {new Date(img.uploaded_at).toLocaleString()}{user.role === 'doctor' && <span className="block text-xs text-slate-600">Patient: {img.patient_name || 'Name not provided'} {img.patient_username ? `(@${img.patient_username})` : ''}</span>}</span><div className="flex gap-3"><button className="text-teal-700 underline" onClick={() => downloadImage(img.id)}>Download verified image</button><button disabled={analyzingId !== null} className="bg-teal-700 text-white rounded-lg px-3 py-2 disabled:opacity-50" onClick={() => analyzeXray(img.id)}>{analyzingId === img.id ? 'Analyzing…' : 'Analyze (research)'}</button><button className="text-teal-700 underline" onClick={() => loadPredictionHistory(img.id)}>Reports</button></div></div>)}</div>
          {analysisResult && <section className="rounded-xl border border-amber-300 bg-amber-50 p-5 space-y-3" aria-live="polite">
            <h4 className="font-bold">Research-only pneumonia classification</h4>
            <p><strong>Prediction:</strong> {analysisResult.label}</p>
            <p><strong>Model score:</strong> {(analysisResult.confidence * 100).toFixed(1)}% (not calibrated clinical confidence)</p>
            <p><strong>Pneumonia probability score:</strong> {(analysisResult.probabilities.PNEUMONIA * 100).toFixed(1)}%</p>
            <p className="text-sm text-amber-900">{analysisResult.disclaimer}</p>
            <img className="max-w-xl w-full rounded-lg border" alt="Grad-CAM overlay indicating regions influencing the model prediction; not a clinical localization" src={`data:image/png;base64,${analysisResult.gradcam_png_base64}`} />
          </section>}
          {selectedPrediction && <section className="border-t pt-5 space-y-3" aria-label="Signed research reports">
            <h4 className="font-semibold text-lg">Signed research reports</h4>
            <p className="text-sm text-slate-600">Prediction: {selectedPrediction}. Reports are encrypted at rest and verified using detached RSA-PSS signatures. Research only.</p>
            <button type="button" disabled={reportBusy} onClick={createReport} className="bg-teal-700 text-white px-4 py-2 rounded-lg disabled:opacity-50">{reportBusy ? 'Generating…' : 'Generate signed PDF report'}</button>
            {reports.length === 0 ? <p className="text-sm text-slate-500">No reports for this prediction.</p> : reports.map(report => <div key={report.id} className="border rounded-lg p-3 flex flex-wrap gap-3 items-center"><span className="text-sm">Report {report.id.slice(0,8)}</span><button type="button" onClick={() => verifyReport(report.id)} className="text-teal-700 underline">Verify signature</button><button type="button" onClick={() => downloadReport(report.id)} className="text-teal-700 underline">Download PDF</button></div>)}
          </section>}
          {user.role === 'patient' && <div className="border-t pt-4 space-y-2"><h4 className="font-semibold">Grant a doctor access</h4><select aria-label="Doctor" className="border rounded-lg p-2" value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)}><option value="">Select a doctor</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.full_name || d.email}{d.username ? ` (@${d.username})` : ''}</option>)}</select><button type="button" onClick={grantDoctor} className="ml-3 bg-slate-800 text-white px-4 py-2 rounded-lg">Grant access</button><p className="text-xs text-slate-500">Revoke access using DELETE /api/images/permissions/{'{doctor_id}'} in Swagger. Do not share data without patient authorization.</p></div>}
        </div>}
        {user.role === 'admin' && <section className="mt-8 border-t pt-6 space-y-4" aria-label="Security audit dashboard">
          <h3 className="font-semibold text-lg">Security audit and monitoring</h3>
          <div className="flex flex-wrap gap-2 items-center">
            <input aria-label="Filter event type" className="border rounded-lg p-2" placeholder="Event type (optional)" value={auditFilter} onChange={e => setAuditFilter(e.target.value)} />
            <button type="button" onClick={loadAudit} className="bg-teal-700 text-white px-4 py-2 rounded-lg">Refresh audit</button>
          </div>
          {auditError && <p role="alert" className="text-red-700">{auditError}</p>}
          {auditSummary && <div className="bg-slate-50 p-4 rounded-lg">
            <p>Total events: {auditSummary.total_audit_events} · Denied (24h): {auditSummary.denied_24h} · Failed logins (24h): {auditSummary.failed_logins_24h}</p>
            {auditSummary.alerts.map((a, i) => <p key={i} className="text-amber-800">Alert: {a.kind} ({a.count})</p>)}
          </div>}
          {auditVerification && <p className={auditVerification.valid ? 'text-teal-700' : 'text-red-700'}>Audit chain: {auditVerification.valid ? 'Verified' : 'INTEGRITY FAILURE'} · {auditVerification.checked} entries checked</p>}
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="p-2">Time</th><th className="p-2">Event</th><th className="p-2">Result</th><th className="p-2">Actor ID</th></tr></thead><tbody>{auditEvents.map(e => <tr key={e.id} className="border-b"><td className="p-2">{new Date(e.created_at).toLocaleString()}</td><td className="p-2">{e.event_type}</td><td className="p-2">{e.result}</td><td className="p-2">{e.actor_id || '—'}</td></tr>)}</tbody></table></div>
        </section>}
        {user.role === 'admin' && <form onSubmit={createDoctor} className="mt-8 max-w-xl space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><UserPlus size={20}/> Create doctor account</h3>
          <label className="block text-sm">Doctor full name<input required minLength={2} value={doctorName} onChange={e => setDoctorName(e.target.value)} className="block w-full mt-1 p-3 border rounded-lg"/></label>
          <label className="block text-sm">Doctor username<input required pattern="[A-Za-z][A-Za-z0-9_.-]{2,39}" value={doctorUsername} onChange={e => setDoctorUsername(e.target.value)} className="block w-full mt-1 p-3 border rounded-lg"/></label>
          <label className="block text-sm">Doctor email<input type="email" required value={doctorEmail} onChange={e => setDoctorEmail(e.target.value)} className="block w-full mt-1 p-3 border rounded-lg"/></label>
          <label className="block text-sm">Temporary password (minimum 12 characters)<input type="password" required minLength={12} value={doctorPassword} onChange={e => setDoctorPassword(e.target.value)} className="block w-full mt-1 p-3 border rounded-lg"/></label>
          <label className="block text-sm">License reference (optional)<input value={doctorLicense} onChange={e => setDoctorLicense(e.target.value)} className="block w-full mt-1 p-3 border rounded-lg"/></label>
          <button disabled={busy} className="bg-teal-700 text-white rounded-lg px-5 py-3 disabled:opacity-50">Create doctor</button>
        </form>}
      </section> : null}
      {user?.role === 'admin' && <section className="bg-white rounded-2xl border border-slate-200 p-7 mt-8 flex gap-4 items-start">
        <ScanLine size={30} className="text-teal-600 shrink-0"/><div><h2 className="font-semibold text-lg">Chest X-ray Analysis</h2>
        <p className="text-slate-600 mt-2">Encrypted image upload and authorized retrieval are available. DenseNet121 inference and Grad-CAM are available after training. Predictions are research-only and must not guide clinical decisions. Use synthetic test images only.</p></div>
      </section>}
    </main>
  </div>
}
