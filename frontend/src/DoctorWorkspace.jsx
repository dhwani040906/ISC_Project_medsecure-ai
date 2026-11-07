import AccountSettings from './AccountSettings'
import { Settings } from 'lucide-react'
import ClinicalReviewPanel from './ClinicalReviewPanel'
import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Activity, ArrowDownToLine, ClipboardList, FileCheck2, FileText, ScanLine, Search, Stethoscope, UserRound, Users, X } from 'lucide-react'
import './doctor.css'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api', timeout: 30000 })
const ref = (prefix, id) => `${prefix}-${String(id).replaceAll('-', '').slice(0, 12).toUpperCase()}`
const date = value => value ? new Date(value).toLocaleString() : 'Unavailable'
const tabs = [['overview','Overview',Activity],['patients','Patients',Users],['review','Image analysis',ScanLine],['reports','Reports',FileText],['history','Scan history',ClipboardList],['profile','Profile',UserRound],['settings','Settings',Settings]]

export default function DoctorWorkspace({ user, token, images, analyzingId, analyzeXray, analysisResult, downloadImage, loadPredictionHistory, selectedPrediction, reports, reportBusy, createReport, verifyReport, downloadReport, profileName, setProfileName, profileUsername, setProfileUsername, saveProfile, busy, onPasswordChanged }) {
  const [tab, setTab] = useState('overview')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState([])
  const [historyBusy, setHistoryBusy] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageError, setImageError] = useState('')
  const [imageBusy, setImageBusy] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [verification, setVerification] = useState({})
  const [reportError, setReportError] = useState('')
  const [reportLoading, setReportLoading] = useState(false)

  const groups = useMemo(() => {
    const map = new Map()
    for (const scan of images) {
      const key = scan.patient_id || scan.patient_username || scan.patient_name || `unknown-${scan.id}`
      if (!map.has(key)) map.set(key, { id: key, name: scan.patient_name || 'Name not provided', username: scan.patient_username || '', scans: [] })
      map.get(key).scans.push(scan)
    }
    return [...map.values()]
  }, [images])
  const matching = images.filter(scan => `${scan.reference || scan.id} ${scan.patient_name || ''} ${scan.patient_username || ''}`.toLowerCase().includes(search.toLowerCase()))
  const matchingGroups = groups.filter(group => `${group.name} ${group.username} ${group.scans.map(s => s.reference || s.id).join(' ')}`.toLowerCase().includes(search.toLowerCase()))
  const activeScan = images.find(scan => scan.id === selected) || null

  useEffect(() => {
    if (!selected || !token) { setImageUrl(''); setImageError(''); return }
    let canceled = false
    let blobUrl = ''
    setImageBusy(true); setImageError(''); setImageUrl('')
    api.get(`/images/${selected}/download`, { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' })
      .then(response => { if (!canceled) { blobUrl = URL.createObjectURL(response.data); setImageUrl(blobUrl) } })
      .catch(() => { if (!canceled) setImageError('Unable to display this image. Check record access and integrity.') })
      .finally(() => { if (!canceled) setImageBusy(false) })
    return () => { canceled = true; if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [selected, token])

  async function openScan(id, destination='review') {
    setSelected(id); setTab(destination); setZoom(100); setHistory([]); setHistoryError(''); setVerification({}); setReportError('')
    setHistoryBusy(true)
    try {
      const response = await api.get(`/analysis/${id}/history`, { headers: { Authorization: `Bearer ${token}` } })
      setHistory(response.data)
      if (response.data.length) await loadPredictionHistory(id)
    } catch { setHistoryError('Unable to load prediction history for this scan.') }
    finally { setHistoryBusy(false) }
  }

  async function checkReport(id) {
    setReportLoading(true); setReportError('')
    try {
      const response = await api.get(`/reports/${id}/verify`, { headers: { Authorization: `Bearer ${token}` } })
      setVerification(prev => ({ ...prev, [id]: response.data.verified ? 'Verified' : 'Verification failed' }))
    } catch { setReportError('Report verification could not be completed.') }
    finally { setReportLoading(false) }
  }

  return <div className="doctor-workspace">
    <header className="doctor-heading"><div><span className="doctor-eyebrow"><Stethoscope size={15}/> DOCTOR WORKSPACE</span><h2>Welcome, {user.full_name?.split(' ')[0] || 'Doctor'}</h2><p>Review authorized chest X-rays and research model results.</p></div><button className="doctor-primary" onClick={() => setTab('patients')}><Users size={17}/> View patients</button></header>
    <nav className="doctor-tabs" aria-label="Doctor workspace sections">{tabs.map(([id, label, Icon]) => <button key={id} className={tab===id?'doctor-tab active':'doctor-tab'} onClick={() => setTab(id)}><Icon size={16}/>{label}</button>)}</nav>

    {tab==='overview' && <section className="doctor-section"><div className="doctor-stats"><div><Users/><span>Patients with accessible scans</span><strong>{groups.length}</strong></div><div><ScanLine/><span>Accessible scans</span><strong>{images.length}</strong></div></div><div className="doctor-panel"><div className="doctor-panel-title"><h3>Recent imaging activity</h3><button onClick={() => setTab('history')}>All scans</button></div>{images.length ? images.slice(0,6).map(scan => <div className="doctor-item" key={scan.id}><div><strong>{scan.reference || ref('XR',scan.id)}</strong><small>{scan.patient_name || 'Patient name unavailable'} · {date(scan.uploaded_at)}</small></div><button onClick={() => openScan(scan.id)}>Open review</button></div>) : <p className="doctor-empty">No accessible scans. Patients must explicitly grant access before their records appear here.</p>}</div><p className="doctor-notice">AI classification is research-only. It is not a clinical diagnosis or a completed physician review.</p></section>}

    {tab==='patients' && <section className="doctor-section"><div className="doctor-panel"><h3>Authorized patients</h3><p className="doctor-muted">Only patients with accessible imaging records appear here. Contact information is not exposed by the current API.</p><label className="doctor-search"><Search size={18}/><input placeholder="Search patient or scan" value={search} onChange={e => setSearch(e.target.value)}/></label>{matchingGroups.length ? matchingGroups.map(group => <div className="doctor-item" key={group.id}><div><strong>{group.name}</strong><small>{group.username ? `@${group.username} · ` : ''}{group.scans.length} accessible scan(s)</small></div><button onClick={() => openScan(group.scans[0].id)}>View scans</button></div>) : <p className="doctor-empty">No matching authorized patients.</p>}</div></section>}

    {(tab==='review'||tab==='history') && <section className="doctor-section"><div className="doctor-panel"><div className="doctor-panel-title"><h3>{tab==='history'?'Accessible scan history':'Imaging review'}</h3><span>{images.length} records</span></div><label className="doctor-search"><Search size={18}/><input placeholder="Search scans or patients" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="doctor-scan-grid"><aside className="doctor-scan-list">{matching.length ? matching.map(scan=><button key={scan.id} className={selected===scan.id?'doctor-scan active':'doctor-scan'} onClick={()=>openScan(scan.id,tab)}><strong>{scan.reference||ref('XR',scan.id)}</strong><small>{scan.patient_name||'Name unavailable'}</small><small>{date(scan.uploaded_at)}</small></button>) : <p className="doctor-empty">No matching scans.</p>}</aside><div className="doctor-review">{!activeScan ? <p className="doctor-empty">Select an authorized scan to view its image, model history and reports.</p> : <><div className="doctor-panel-title"><div><h4>{activeScan.reference||ref('XR',activeScan.id)}</h4><small>{activeScan.patient_name||'Name unavailable'} · {date(activeScan.uploaded_at)}</small></div><button onClick={()=>setSelected(null)} aria-label="Close scan"><X size={18}/></button></div><div className="doctor-viewer">{imageBusy ? <p>Loading verified image…</p> : imageError ? <p role="alert">{imageError}</p> : imageUrl ? <img src={imageUrl} style={{width:`${zoom}%`}} alt="Authorized chest X-ray"/> : null}</div><div className="doctor-actions"><label>Zoom <input type="range" min="60" max="180" step="10" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/>{zoom}%</label><button onClick={()=>downloadImage(activeScan.id)}><ArrowDownToLine size={16}/> Download</button><button disabled={analyzingId!==null} className="doctor-primary" onClick={()=>analyzeXray(activeScan.id)}>{analyzingId===activeScan.id?'Analyzing…':'Run AI analysis'}</button></div>{analysisResult?.imageId===activeScan.id && <div className="doctor-result"><h4>New AI result · Research only</h4><p><strong>Prediction:</strong> {analysisResult.label}</p><p><strong>Model score (uncalibrated):</strong> {Number(analysisResult.confidence*100).toFixed(1)}%</p>{analysisResult.gradcam_png_base64 && <img src={`data:image/png;base64,${analysisResult.gradcam_png_base64}`} alt="Grad-CAM overlay showing model attention, not a clinical localization"/>}<p>This model output is not a medical diagnosis.</p></div>}<ClinicalReviewPanel predictionId={history[0]?.id || null} token={token}/><div className="doctor-history"><h4>Previous AI analyses</h4>{historyBusy ? <p>Loading…</p> : historyError ? <p role="alert">{historyError}</p> : history.length ? history.map(p=><div key={p.id} className="doctor-item"><div><strong>{p.label}</strong><small>{date(p.created_at)} · Model score {(p.confidence*100).toFixed(1)}%</small></div><button onClick={()=>{setTab('reports');loadPredictionHistory(activeScan.id)}}>Reports</button></div>) : <p className="doctor-muted">No earlier analysis for this scan.</p>}</div></>}</div></div></div></section>}

    {tab==='reports' && <section className="doctor-section"><div className="doctor-panel"><h3>Signed research reports</h3><p className="doctor-muted">Select an accessible scan to retrieve its most recent prediction and associated reports. A cryptographic signature confirms document authenticity, not physician approval.</p><div className="doctor-scan-select">{images.map(scan=><button key={scan.id} onClick={()=>openScan(scan.id,'reports')} className={selected===scan.id?'active':''}>{scan.reference||ref('XR',scan.id)}</button>)}</div>{!images.length && <p className="doctor-empty">No accessible scans.</p>}{activeScan && <div className="doctor-report-area"><p><strong>Selected scan:</strong> {activeScan.reference||ref('XR',activeScan.id)}</p>{historyBusy ? <p>Loading report history…</p> : (history.length > 0 && selectedPrediction === history[0].id) ? <><button className="doctor-primary" disabled={reportBusy} onClick={createReport}>{reportBusy?'Generating…':'Generate signed research report'}</button>{reports.length ? reports.map(report=><div className="doctor-item" key={report.id}><div><strong>{ref('RPT',report.id)}</strong><small>{date(report.created_at)} {verification[report.id]?`· ${verification[report.id]}`:''}</small></div><div className="doctor-actions"><button disabled={reportLoading} onClick={()=>checkReport(report.id)}><FileCheck2 size={16}/> Verify</button><button onClick={()=>downloadReport(report.id)}><ArrowDownToLine size={16}/> PDF</button></div></div>) : <p className="doctor-muted">No reports for the latest prediction.</p>}</> : <p className="doctor-muted">No prediction found. Analyze the scan first.</p>}{reportError && <p role="alert">{reportError}</p>}</div>}</div></section>}

    {tab==='settings' && <section className="doctor-section"><AccountSettings token={token} onPasswordChanged={onPasswordChanged}/></section>}
    {tab==='profile' && <section className="doctor-section"><div className="doctor-panel"><h3>Doctor profile</h3><form className="doctor-profile" onSubmit={saveProfile}><label>Full name<input required minLength={2} maxLength={120} value={profileName} onChange={e=>setProfileName(e.target.value)}/></label><label>Username<input required pattern="[A-Za-z][A-Za-z0-9_.-]{2,39}" value={profileUsername} onChange={e=>setProfileUsername(e.target.value)}/></label><label>Email<input value={user.email} readOnly/></label><button disabled={busy} className="doctor-primary">Save profile</button></form></div></section>}
  </div>
}
