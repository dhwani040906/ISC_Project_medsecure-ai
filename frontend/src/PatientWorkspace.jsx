import AccountSettings from './AccountSettings'
import { Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Activity, ArrowDownToLine, CheckCircle2, FileText, ImagePlus, ScanLine, ShieldCheck, UserRound, Users } from 'lucide-react'

const tabs = [
  ['overview', 'Dashboard', Activity],
  ['upload', 'New Analysis', ImagePlus],
  ['scans', 'My Scans', ScanLine],
  ['reports', 'My Reports', FileText],
  ['profile', 'Profile', UserRound],
  ['settings', 'Settings', Settings],
]
const shortId = (prefix, id) => `${prefix}-${String(id).replaceAll('-', '').slice(0, 12).toUpperCase()}`
const dateLabel = value => value ? new Date(value).toLocaleString() : 'Not available'

export default function PatientWorkspace({
  user, images, imageFile, setImageFile, uploadImage, busy, uploadProgress,
  analyzingId, analyzeXray, analysisResult, downloadImage, loadPredictionHistory,
  selectedPrediction, reports, reportBusy, createReport, verifyReport, downloadReport,
  doctors, selectedDoctor, setSelectedDoctor, grantDoctor,
  profileName, setProfileName, profileUsername, setProfileUsername, saveProfile, token, onPasswordChanged,
}) {
  const [tab, setTab] = useState('overview')
  const [preview, setPreview] = useState('')
  const [dragging, setDragging] = useState(false)
  const [search, setSearch] = useState('')
  const [fileError, setFileError] = useState('')

  useEffect(() => {
    if (!imageFile) { setPreview(''); return }
    const url = URL.createObjectURL(imageFile)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  function selectFile(file) {
    setFileError('')
    if (!file) { setImageFile(null); return }
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setFileError('Please select a PNG or JPEG chest X-ray.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError('The maximum file size is 10 MiB.')
      return
    }
    setImageFile(file)
  }
  const filtered = images.filter(img => `${img.reference || img.id} ${img.status || ''}`.toLowerCase().includes(search.toLowerCase()))

  return <div className="patient-workspace">
    <div className="patient-intro">
      <div><p className="patient-eyebrow">PATIENT PORTAL</p><h2>Welcome, {user.full_name?.split(' ')[0] || 'Patient'}</h2><p>Manage your chest X-rays and research analysis reports in one secure workspace.</p></div>
      <button className="patient-primary" onClick={() => setTab('upload')}><ImagePlus size={18}/> New X-ray analysis</button>
    </div>
    <nav className="patient-tabs" aria-label="Patient workspace sections">
      {tabs.map(([id, title, Icon]) => <button key={id} className={tab === id ? 'patient-tab active' : 'patient-tab'} onClick={() => setTab(id)}><Icon size={17}/>{title}</button>)}
    </nav>
    {tab === 'overview' && <div className="patient-section">
      <div className="patient-stats">
        <div className="patient-stat"><ScanLine size={22}/><span>Total uploaded scans</span><strong>{images.length}</strong></div>
        <div className="patient-stat"><ShieldCheck size={22}/><span>Secure record storage</span><strong>Enabled</strong></div>
      </div>
      <div className="patient-panel"><div className="patient-panel-head"><h3>Recent scan activity</h3><button onClick={() => setTab('scans')}>View all scans</button></div>
        {images.length === 0 ? <p className="patient-empty">No X-rays uploaded yet. Start by uploading a PNG or JPEG chest X-ray.</p> : images.slice(0, 5).map(img => <div className="patient-record" key={img.id}><div><strong>{img.reference || shortId('XR', img.id)}</strong><span>{dateLabel(img.uploaded_at)}</span></div><button onClick={() => { setTab('scans'); loadPredictionHistory(img.id) }}>View scan</button></div>)}
      </div>
      <p className="patient-disclaimer">AI results are experimental and are not a clinical diagnosis. Consult a qualified medical professional.</p>
    </div>}
    {tab === 'upload' && <div className="patient-section">
      <div className="patient-panel"><h3>Upload a chest X-ray</h3><p className="patient-muted">PNG or JPEG, up to 10 MiB. Your image is protected during storage.</p>
        <form onSubmit={async event => { await uploadImage(event); }}>
          <div className={dragging ? 'patient-dropzone dragging' : 'patient-dropzone'} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); selectFile(e.dataTransfer.files[0]) }}>
            <ImagePlus size={34}/><strong>Drag and drop an X-ray here</strong><span>or select a file from your device</span>
            <input aria-label="Select chest X-ray" type="file" accept="image/png,image/jpeg" onChange={e => selectFile(e.target.files?.[0])}/>
          </div>
          {fileError && <p role="alert" className="patient-error">{fileError}</p>}
          {preview && <div className="patient-preview"><img src={preview} alt="Selected X-ray preview"/><div><strong>{imageFile.name}</strong><p>{(imageFile.size / (1024 * 1024)).toFixed(2)} MiB</p></div></div>}
          {busy && uploadProgress !== null && <div className="patient-progress" aria-label="Upload progress"><div style={{width:`${uploadProgress}%`}}/></div>}
          <button className="patient-primary" disabled={!imageFile || busy || !!fileError} type="submit">{busy ? 'Uploading securely…' : 'Upload X-ray'}</button>
        </form>
      </div>
      {analysisResult && <AnalysisPanel result={analysisResult}/>}
      <p className="patient-disclaimer">Only upload images you have permission to process. Use synthetic test data in this research prototype.</p>
    </div>}
    {tab === 'scans' && <div className="patient-section"><div className="patient-panel"><div className="patient-panel-head"><h3>My scans</h3><input aria-label="Search scans" placeholder="Search scan reference or status" value={search} onChange={e => setSearch(e.target.value)}/></div>
      {filtered.length === 0 ? <p className="patient-empty">{images.length ? 'No scans match your search.' : 'No scans available yet.'}</p> : filtered.map(img => <div className="patient-record" key={img.id}><div><strong>{img.reference || shortId('XR', img.id)}</strong><span>{dateLabel(img.uploaded_at)} · {img.status || 'Stored'}</span></div><div className="patient-actions"><button onClick={() => downloadImage(img.id)}><ArrowDownToLine size={15}/> Image</button><button onClick={() => { loadPredictionHistory(img.id); setTab('reports') }}>Reports</button><button className="patient-primary small" disabled={!!analyzingId} onClick={async () => { await analyzeXray(img.id); setTab('scans') }}>{analyzingId === img.id ? 'Analyzing…' : 'Run AI analysis'}</button></div></div>)}
    </div>{analysisResult && <AnalysisPanel result={analysisResult}/>}</div>}
    {tab === 'reports' && <div className="patient-section"><div className="patient-panel"><h3>My reports</h3><p className="patient-muted">Select a scan to load its existing predictions and signed reports. Reports remain encrypted until authorized download.</p>
      <div className="patient-scan-select">{images.map(img => <button key={img.id} onClick={() => loadPredictionHistory(img.id)}>{img.reference || shortId('XR', img.id)}</button>)}</div>
      {images.length === 0 && <p className="patient-empty">Upload and analyze an X-ray to generate a report.</p>}
      {selectedPrediction && <div className="patient-report-area"><p>Selected prediction: <strong>{shortId('PR', selectedPrediction)}</strong></p><button className="patient-primary" disabled={reportBusy} onClick={createReport}>{reportBusy ? 'Generating…' : 'Generate signed PDF'}</button>
        {reports.length === 0 ? <p className="patient-muted">No reports have been generated for this prediction.</p> : reports.map(report => <div className="patient-record" key={report.id}><div><strong>{shortId('RP', report.id)}</strong><span>Signed research report</span></div><div className="patient-actions"><button onClick={() => verifyReport(report.id)}><CheckCircle2 size={15}/> Verify</button><button onClick={() => downloadReport(report.id)}><ArrowDownToLine size={15}/> Download</button></div></div>)}
      </div>}
    </div></div>}
    {tab === 'profile' && <div className="patient-section"><div className="patient-panel"><h3>My profile</h3><p className="patient-muted">Your updated name will appear in newly generated reports. Existing signed reports are not modified.</p>
      <form onSubmit={saveProfile} className="patient-profile-form"><label>Full name<input required minLength={2} maxLength={120} value={profileName} onChange={e => setProfileName(e.target.value)}/></label><label>Username<input required pattern="[A-Za-z][A-Za-z0-9_.-]{2,39}" value={profileUsername} onChange={e => setProfileUsername(e.target.value)}/></label><label>Email<input readOnly value={user.email}/></label><button className="patient-primary" disabled={busy}>Save profile</button></form>
      </div><div className="patient-panel"><h3><Users size={19}/> Doctor access</h3><p className="patient-muted">Grant a doctor access to your imaging records. Only authorized doctors may access them.</p><div className="patient-access"><select aria-label="Choose doctor" value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)}><option value="">Select a doctor</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.full_name || d.email}{d.username ? ` (@${d.username})` : ''}</option>)}</select><button className="patient-primary" type="button" disabled={!selectedDoctor} onClick={grantDoctor}>Grant access</button></div><p className="patient-muted">Access revocation is not yet available in this screen; the existing backend revoke endpoint remains available.</p></div>
    </div>}
    {tab === 'settings' && <div className="patient-section"><AccountSettings token={token} onPasswordChanged={onPasswordChanged}/></div>}
  </div>
}

function AnalysisPanel({ result }) {
  return <div className="patient-panel patient-analysis"><h3>AI analysis result</h3><p><strong>Prediction:</strong> {result.label}</p><p><strong>Model score:</strong> {(result.confidence * 100).toFixed(1)}% (uncalibrated)</p>{result.gradcam_png_base64 && <img src={`data:image/png;base64,${result.gradcam_png_base64}`} alt="Grad-CAM model attention overlay, not a clinical localization"/>}<p className="patient-disclaimer">{result.disclaimer || 'Research only. Not a clinical diagnosis.'}</p></div>
}
