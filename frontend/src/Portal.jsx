
import AdminWorkspace from './AdminWorkspace'
import DoctorWorkspace from './DoctorWorkspace'
import PatientWorkspace from './PatientWorkspace'
import './patient.css'

import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { ShieldCheck, LogOut } from 'lucide-react'

// API configuration
const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    'http://localhost:8000/api',
  timeout: 10000,
})

// Store the login token for the current browser tab.
const SESSION_KEY = 'medsecure_access_token'

export default function Portal() {
  const [searchParams] = useSearchParams()

  // Backend status
  const [apiStatus, setApiStatus] = useState('Checking…')
  const [dbStatus, setDbStatus] = useState('Checking…')

  // Authentication
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [restoringSession, setRestoringSession] = useState(true)

  const [mode, setMode] = useState(
    searchParams.get('mode') === 'register'
      ? 'register'
      : 'login'
  )

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')

  // Profile
  const [profileName, setProfileName] = useState('')
  const [profileUsername, setProfileUsername] = useState('')

  // General
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [dashboard, setDashboard] = useState(null)

  // Doctor registration
  const [doctorEmail, setDoctorEmail] = useState('')
  const [doctorPassword, setDoctorPassword] = useState('')
  const [doctorLicense, setDoctorLicense] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [doctorUsername, setDoctorUsername] = useState('')

  // Images and analysis
  const [images, setImages] = useState([])
  const [analysisResult, setAnalysisResult] = useState(null)
  const [analyzingId, setAnalyzingId] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(null)

  // Doctor permissions
  const [doctors, setDoctors] = useState([])
  const [selectedDoctor, setSelectedDoctor] = useState('')

  // Audit
  const [auditEvents, setAuditEvents] = useState([])
  const [auditSummary, setAuditSummary] = useState(null)
  const [auditVerification, setAuditVerification] = useState(null)
  const [auditFilter, setAuditFilter] = useState('')
  const [auditError, setAuditError] = useState('')

  // Reports
  const [reports, setReports] = useState([])
  const [selectedPrediction, setSelectedPrediction] = useState('')
  const [reportBusy, setReportBusy] = useState(false)

  const authHeaders = token
    ? { Authorization: `Bearer ${token}` }
    : {}

  // ------------------------------------
  // Error handling
  // ------------------------------------

  const errorMessage = (err) => {
    const detail = err.response?.data?.detail

    if (typeof detail === 'string') {
      return detail
    }

    if (err.response?.status === 422) {
      return 'Please check the submitted information.'
    }

    return 'Request failed. Check the backend and try again.'
  }

  // ------------------------------------
  // Load dashboard
  // ------------------------------------

  const fetchDashboard = async (role, accessToken) => {
    const endpoint =
      role === 'admin'
        ? '/admin/dashboard'
        : role === 'doctor'
          ? '/doctor/dashboard'
          : '/patient/dashboard'

    const result = await api.get(endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    setDashboard(result.data)
  }

  // ------------------------------------
  // Load images
  // ------------------------------------

  const loadImages = async (accessToken) => {
    const response = await api.get('/images', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    setImages(response.data)
  }

  // ------------------------------------
  // Upload X-ray
  // ------------------------------------

  const uploadImage = async (event) => {
    event.preventDefault()

    if (!imageFile) return

    setBusy(true)
    setMessage('')
    setUploadProgress(0)

    try {
      const form = new FormData()
      form.append('file', imageFile)

      await api.post('/images', form, {
        headers: authHeaders,
        timeout: 30000,
        onUploadProgress: (e) => {
          if (e.total) {
            setUploadProgress(
              Math.round((e.loaded * 100) / e.total)
            )
          }
        },
      })

      await loadImages(token)

      setImageFile(null)
      event.target.reset()

      setMessage('X-ray encrypted and uploaded.')
    } catch (err) {
      setMessage(errorMessage(err))
    } finally {
      setBusy(false)
      setUploadProgress(null)
    }
  }

  // ------------------------------------
  // Download X-ray
  // ------------------------------------

  const downloadImage = async (id) => {
    try {
      const result = await api.get(
        `/images/${id}/download`,
        {
          headers: authHeaders,
          responseType: 'blob',
        }
      )

      const url = URL.createObjectURL(result.data)

      const link = document.createElement('a')
      link.href = url

      link.download = `xray-${id}.${
        result.data.type === 'image/png'
          ? 'png'
          : 'jpg'
      }`

      link.click()

      setTimeout(() => {
        URL.revokeObjectURL(url)
      }, 1000)
    } catch (err) {
      setMessage(
        'Unable to download image. Check access and integrity.'
      )
    }
  }

  // ------------------------------------
  // AI analysis
  // ------------------------------------

  const analyzeXray = async (id) => {
    setAnalyzingId(id)
    setAnalysisResult(null)
    setMessage('')

    try {
      const response = await api.post(
        `/analysis/${id}`,
        {},
        {
          headers: authHeaders,
          timeout: 120000,
        }
      )

      setAnalysisResult({
        ...response.data,
        imageId: id,
      })

      setSelectedPrediction('')
      setReports([])

      setMessage(
        'Research model analysis completed. This is not a medical diagnosis.'
      )
    } catch (err) {
      setMessage(errorMessage(err))
    } finally {
      setAnalyzingId(null)
    }
  }

  // ------------------------------------
  // Reports
  // ------------------------------------

  const fetchReports = async (predictionId) => {
    const response = await api.get(
      `/reports/predictions/${predictionId}`,
      {
        headers: authHeaders,
      }
    )

    setReports(response.data)
  }

  const loadPredictionHistory = async (imageId) => {
    setMessage('')

    try {
      const result = await api.get(
        `/analysis/${imageId}/history`,
        {
          headers: authHeaders,
        }
      )

      if (result.data.length === 0) {
        setMessage('Analyze this image first.')
        return
      }

      setSelectedPrediction(result.data[0].id)

      await fetchReports(result.data[0].id)
    } catch (err) {
      setMessage(errorMessage(err))
    }
  }

  const createReport = async () => {
    if (!selectedPrediction) return

    setReportBusy(true)
    setMessage('')

    try {
      const result = await api.post(
        `/reports/predictions/${selectedPrediction}`,
        {},
        {
          headers: authHeaders,
          timeout: 30000,
        }
      )

      await fetchReports(selectedPrediction)

      setMessage(
        `Signed encrypted research report created: ${result.data.id}`
      )
    } catch (err) {
      setMessage(errorMessage(err))
    } finally {
      setReportBusy(false)
    }
  }

  const verifyReport = async (id) => {
    try {
      const result = await api.get(
        `/reports/${id}/verify`,
        {
          headers: authHeaders,
        }
      )

      setMessage(
        result.data.verified
          ? 'Report SHA-256 integrity and RSA-PSS signature verified.'
          : 'WARNING: Report verification failed. Do not use this report.'
      )
    } catch (err) {
      setMessage(errorMessage(err))
    }
  }

  const downloadReport = async (id) => {
    try {
      const result = await api.get(
        `/reports/${id}/download`,
        {
          headers: authHeaders,
          responseType: 'blob',
          timeout: 30000,
        }
      )

      const url = URL.createObjectURL(result.data)

      const link = document.createElement('a')
      link.href = url
      link.download = `research-report-${id}.pdf`
      link.click()

      setTimeout(() => {
        URL.revokeObjectURL(url)
      }, 1000)
    } catch (err) {
      setMessage(
        'Report download failed or integrity verification failed.'
      )
    }
  }

  // ------------------------------------
  // Doctor access permissions
  // ------------------------------------

  const grantDoctor = async () => {
    if (!selectedDoctor) return

    try {
      await api.post(
        `/images/permissions/${selectedDoctor}`,
        {},
        {
          headers: authHeaders,
        }
      )

      setMessage('Doctor access granted.')
    } catch (err) {
      setMessage(errorMessage(err))
    }
  }

  // ------------------------------------
  // Check backend health
  // ------------------------------------

  useEffect(() => {
    api.get('/health')
      .then(() => setApiStatus('Connected'))
      .catch(() => setApiStatus('Unavailable'))

    api.get('/health/database')
      .then(() => setDbStatus('Connected'))
      .catch(() => setDbStatus('Unavailable'))
  }, [])

  // ------------------------------------
  // Restore session after page refresh
  // ------------------------------------

  useEffect(() => {
    let active = true

    const restoreSession = async () => {
      const savedToken = sessionStorage.getItem(SESSION_KEY)

      if (!savedToken) {
        if (active) {
          setRestoringSession(false)
        }
        return
      }

      const headers = {
        Authorization: `Bearer ${savedToken}`,
      }

      try {
        // Validate saved JWT.
        const response = await api.get('/auth/me', {
          headers,
        })

        if (!active) return

        const currentUser = response.data

        setToken(savedToken)
        setUser(currentUser)

        setProfileName(currentUser.full_name || '')
        setProfileUsername(currentUser.username || '')

        // Restore dashboard.
        const endpoint =
          currentUser.role === 'admin'
            ? '/admin/dashboard'
            : currentUser.role === 'doctor'
              ? '/doctor/dashboard'
              : '/patient/dashboard'

        const dashboardResponse = await api.get(
          endpoint,
          { headers }
        )

        if (!active) return

        setDashboard(dashboardResponse.data)

        // Restore patient and doctor images.
        if (currentUser.role !== 'admin') {
          const imagesResponse = await api.get(
            '/images',
            { headers }
          )

          if (!active) return

          setImages(imagesResponse.data)
        }

        // Restore doctor directory for patients.
        if (currentUser.role === 'patient') {
          const directoryResponse = await api.get(
            '/images/permissions/doctors',
            { headers }
          )

          if (!active) return

          setDoctors(directoryResponse.data)
        }
      } catch (err) {
        if (!active) return

        if (
          err.response?.status === 401 ||
          err.response?.status === 403
        ) {
          // Expired or revoked session.
          sessionStorage.removeItem(SESSION_KEY)

          setToken(null)
          setUser(null)
          setDashboard(null)
          setImages([])
          setDoctors([])

          setMessage(
            'Your session expired or is no longer authorized. Please sign in again.'
          )
        } else {
          setMessage(
            'Could not restore all workspace data. Check your backend connection and refresh.'
          )
        }
      } finally {
        if (active) {
          setRestoringSession(false)
        }
      }
    }

    restoreSession()

    return () => {
      active = false
    }
  }, [])

  // ------------------------------------
  // Login and registration
  // ------------------------------------

  const submit = async (event) => {
    event.preventDefault()

    setBusy(true)
    setMessage('')

    try {
      if (mode === 'register') {
        await api.post('/auth/register', {
          email,
          password,
          full_name: fullName,
          username,
        })

        setMessage(
          'Registration successful. Sign in to continue.'
        )

        setMode('login')
        setPassword('')
      } else {
        const response = await api.post('/auth/login', {
          email,
          password,
        })

        const accessToken = response.data.access_token
        const currentUser = response.data.user

        // Save session token for page refresh.
        sessionStorage.setItem(
          SESSION_KEY,
          accessToken
        )

        setToken(accessToken)
        setUser(currentUser)

        setProfileName(currentUser.full_name || '')
        setProfileUsername(currentUser.username || '')

        setPassword('')

        await fetchDashboard(
          currentUser.role,
          accessToken
        )

        if (currentUser.role !== 'admin') {
          await loadImages(accessToken)
        }

        if (currentUser.role === 'patient') {
          const directory = await api.get(
            '/images/permissions/doctors',
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          )

          setDoctors(directory.data)
        }
      }
    } catch (err) {
      setMessage(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  // ------------------------------------
  // Logout
  // ------------------------------------

  const logout = async (passwordChanged = false) => {
    const currentToken = token

    // Clear the locally stored session.
    sessionStorage.removeItem(SESSION_KEY)

    setToken(null)
    setUser(null)
    setDashboard(null)
    setImages([])
    setAnalysisResult(null)
    setDoctors([])
    setPassword('')
    setReports([])
    setSelectedPrediction('')
    setMessage(passwordChanged ? 'Password changed successfully. Sign in again with your new password.' : '')

    try {
      if (currentToken && !passwordChanged) {
        await api.post(
          '/auth/logout',
          {},
          {
            headers: {
              Authorization: `Bearer ${currentToken}`,
            },
          }
        )
      }
    } catch (err) {
      setMessage(
        'Signed out locally. Server logout could not be confirmed.'
      )
    }
  }

  // ------------------------------------
  // Create doctor account
  // ------------------------------------

  const createDoctor = async (event) => {
    event.preventDefault()

    setBusy(true)
    setMessage('')

    try {
      await api.post(
        '/auth/doctors',
        {
          email: doctorEmail,
          password: doctorPassword,
          full_name: doctorName,
          username: doctorUsername,
          license_reference: doctorLicense || null,
        },
        {
          headers: authHeaders,
        }
      )

      setMessage('Doctor account created successfully.')

      setDoctorEmail('')
      setDoctorPassword('')
      setDoctorLicense('')
      setDoctorName('')
      setDoctorUsername('')

      await fetchDashboard('admin', token)
    } catch (err) {
      setMessage(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  // ------------------------------------
  // Update profile
  // ------------------------------------

  const saveProfile = async (event) => {
    event.preventDefault()

    setBusy(true)
    setMessage('')

    try {
      const result = await api.patch(
        '/auth/me/profile',
        {
          full_name: profileName,
          username: profileUsername,
        },
        {
          headers: authHeaders,
        }
      )

      setUser(result.data)

      setMessage(
        'Profile updated. Newly generated reports will use this information.'
      )
    } catch (err) {
      setMessage(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  // ------------------------------------
  // Audit logs
  // ------------------------------------

  const loadAudit = async () => {
    setAuditError('')

    try {
      const [summary, events, verify] = await Promise.all([
        api.get('/audit/summary', {
          headers: authHeaders,
        }),

        api.get('/audit/events', {
          headers: authHeaders,
          params: {
            limit: 50,
            ...(auditFilter
              ? { event_type: auditFilter }
              : {}),
          },
        }),

        api.get('/audit/verify', {
          headers: authHeaders,
        }),
      ])

      setAuditSummary(summary.data)
      setAuditEvents(events.data)
      setAuditVerification(verify.data)
    } catch (err) {
      setAuditError(errorMessage(err))
    }
  }

  // ------------------------------------
  // Session loading screen
  // ------------------------------------

  if (restoringSession) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-slate-50"
        role="status"
      >
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-700 border-t-transparent rounded-full animate-spin mx-auto mb-5" />

          <h2 className="text-xl font-semibold text-slate-800">
            MedSecure AI
          </h2>

          <p className="text-slate-500 mt-2">
            Checking your session...
          </p>
        </div>
      </div>
    )
  }

  // ------------------------------------
  // Main portal interface
  // ------------------------------------

  return (
    <div className="min-h-screen">
      <header className="bg-[#102a47] text-white px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <ShieldCheck
            size={30}
            className="text-teal-300"
          />

          <Link
            to="/"
            className="font-bold text-xl"
          >
            MedSecure AI
          </Link>

          <Link
            to="/"
            className="ml-auto text-sm text-slate-300 hover:text-white"
          >
            Back to website
          </Link>

          {user && (
            <button
              onClick={() => logout()}
              className="ml-4 flex items-center gap-2 text-sm bg-slate-700 rounded-lg px-3 py-2"
            >
              <LogOut size={16} />
              Logout
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <p className="text-teal-700 font-semibold">
          YOUR SECURE WORKSPACE
        </p>

        <h1 className="text-3xl font-bold mt-2">
          MedSecure AI Portal
        </h1>

        <p className="text-slate-600 mt-3 mb-8">
          Sign in to manage authorized imaging records and reports.
        </p>

        {/* Patient portal */}

        {user?.role === 'patient' && (
          <PatientWorkspace
            user={user}
            token={token}
            onPasswordChanged={() => logout(true)}
            images={images}
            imageFile={imageFile}
            setImageFile={setImageFile}
            uploadImage={uploadImage}
            busy={busy}
            uploadProgress={uploadProgress}
            analyzingId={analyzingId}
            analyzeXray={analyzeXray}
            analysisResult={analysisResult}
            downloadImage={downloadImage}
            loadPredictionHistory={loadPredictionHistory}
            selectedPrediction={selectedPrediction}
            reports={reports}
            reportBusy={reportBusy}
            createReport={createReport}
            verifyReport={verifyReport}
            downloadReport={downloadReport}
            doctors={doctors}
            selectedDoctor={selectedDoctor}
            setSelectedDoctor={setSelectedDoctor}
            grantDoctor={grantDoctor}
            profileName={profileName}
            setProfileName={setProfileName}
            profileUsername={profileUsername}
            setProfileUsername={setProfileUsername}
            saveProfile={saveProfile}
          />
        )}

        {/* Doctor portal */}

        {user?.role === 'doctor' && (
          <DoctorWorkspace
            user={user}
            token={token}
            onPasswordChanged={() => logout(true)}
            images={images}
            analyzingId={analyzingId}
            analyzeXray={analyzeXray}
            analysisResult={analysisResult}
            downloadImage={downloadImage}
            loadPredictionHistory={loadPredictionHistory}
            selectedPrediction={selectedPrediction}
            reports={reports}
            reportBusy={reportBusy}
            createReport={createReport}
            verifyReport={verifyReport}
            downloadReport={downloadReport}
            profileName={profileName}
            setProfileName={setProfileName}
            profileUsername={profileUsername}
            setProfileUsername={setProfileUsername}
            saveProfile={saveProfile}
            busy={busy}
          />
        )}

        {/* Messages */}

        {message && (
          <div
            role="alert"
            className="mt-6 bg-white border border-slate-300 rounded-xl p-4 text-slate-700"
          >
            {message}
          </div>
        )}

        {/* Login and registration */}

        {!user ? (
          <section className="bg-white rounded-2xl border border-slate-200 p-7 mt-8 max-w-xl">
            <div className="flex gap-3 mb-5">
              <button
                onClick={() => {
                  setMode('login')
                  setMessage('')
                }}
                className={`rounded-lg px-4 py-2 ${
                  mode === 'login'
                    ? 'bg-teal-700 text-white'
                    : 'bg-slate-100'
                }`}
              >
                Sign in
              </button>

              <button
                onClick={() => {
                  setMode('register')
                  setMessage('')
                }}
                className={`rounded-lg px-4 py-2 ${
                  mode === 'register'
                    ? 'bg-teal-700 text-white'
                    : 'bg-slate-100'
                }`}
              >
                Patient registration
              </button>
            </div>

            <h2 className="font-semibold text-xl mb-4">
              {mode === 'login'
                ? 'Account login'
                : 'Register as patient'}
            </h2>

            <form
              onSubmit={submit}
              className="space-y-4"
            >
              <label className="block text-sm">
                Email
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  className="block w-full mt-1 p-3 border rounded-lg"
                />
              </label>

              {mode === 'register' && (
                <>
                  <label className="block text-sm">
                    Full name
                    <input
                      required
                      minLength={2}
                      maxLength={120}
                      value={fullName}
                      onChange={(e) =>
                        setFullName(e.target.value)
                      }
                      className="block w-full mt-1 p-3 border rounded-lg"
                    />
                  </label>

                  <label className="block text-sm">
                    Username
                    <input
                      required
                      pattern="[A-Za-z][A-Za-z0-9_.-]{2,39}"
                      value={username}
                      onChange={(e) =>
                        setUsername(e.target.value)
                      }
                      className="block w-full mt-1 p-3 border rounded-lg"
                    />
                  </label>
                </>
              )}

              <label className="block text-sm">
                Password
                <input
                  type="password"
                  required
                  minLength={
                    mode === 'register'
                      ? 12
                      : undefined
                  }
                  autoComplete={
                    mode === 'register'
                      ? 'new-password'
                      : 'current-password'
                  }
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  className="block w-full mt-1 p-3 border rounded-lg"
                />
              </label>

              <button
                disabled={busy}
                className="bg-teal-700 disabled:opacity-50 text-white rounded-lg px-5 py-3"
              >
                {busy
                  ? 'Please wait…'
                  : mode === 'login'
                    ? 'Sign in'
                    : 'Create patient account'}
              </button>
            </form>

            <p className="text-sm text-slate-500 mt-4">
              Doctor accounts are created by an administrator.
              Admin accounts are provisioned through the backend CLI.
            </p>
          </section>
        ) : user.role === 'admin' ? (
          <AdminWorkspace
            user={user}
            dashboard={dashboard}
            apiStatus={apiStatus}
            dbStatus={dbStatus}
            auditEvents={auditEvents}
            auditSummary={auditSummary}
            auditVerification={auditVerification}
            auditFilter={auditFilter}
            setAuditFilter={setAuditFilter}
            auditError={auditError}
            loadAudit={loadAudit}
            doctorName={doctorName}
            setDoctorName={setDoctorName}
            doctorUsername={doctorUsername}
            setDoctorUsername={setDoctorUsername}
            doctorEmail={doctorEmail}
            setDoctorEmail={setDoctorEmail}
            doctorPassword={doctorPassword}
            setDoctorPassword={setDoctorPassword}
            doctorLicense={doctorLicense}
            setDoctorLicense={setDoctorLicense}
            createDoctor={createDoctor}
            busy={busy}
          />
        ) : null}
      </main>
    </div>
  )
}
