import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, CheckCircle, AlertCircle, Loader, ExternalLink, Lock } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

const STEP = {
  CHECKING: 'checking',
  WAITING: 'waiting',
  DONE: 'done',
  ERROR: 'error',
}

function sendMsg(message) {
  return new Promise((resolve, reject) => {
    if (!chrome?.runtime?.sendMessage) {
      reject(new Error('No Chrome API'))
      return
    }
    chrome.runtime.sendMessage(message, (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else {
        resolve(res)
      }
    })
  })
}

export default function AuthPage() {
  const navigate = useNavigate()
  const { authenticated, checkAuth } = useAuthStore()
  const [step, setStep] = useState(STEP.CHECKING)
  const [orgUrl, setOrgUrl] = useState(null)
  const [error, setError] = useState(null)
  const [pollCount, setPollCount] = useState(0)

  useEffect(() => {
    if (authenticated) navigate('/', { replace: true })
  }, [authenticated])

  const check = useCallback(async () => {
    try {
      const res = await sendMsg({ type: 'GET_AUTH_STATUS' })
      if (res?.authenticated) {
        setOrgUrl(res.orgUrl)
        setStep(STEP.DONE)
        await checkAuth()
        setTimeout(() => navigate('/', { replace: true }), 1200)
        return true
      }
    } catch { }
    return false
  }, [navigate, checkAuth])

  useEffect(() => {
    let interval
    let mounted = true

    const start = async () => {
      setStep(STEP.CHECKING)
      const found = await check()
      if (!mounted || found) return

      setStep(STEP.WAITING)
      let n = 0
      interval = setInterval(async () => {
        if (!mounted) return
        n++
        setPollCount(n)
        const found = await check()
        if (found) { clearInterval(interval); return }
        if (n > 60) {
          clearInterval(interval)
          setStep(STEP.ERROR)
          setError('Could not detect your D365 session. Please make sure your D365 org is open in Chrome.')
        }
      }, 5000)
    }

    start()
    return () => { mounted = false; clearInterval(interval) }
  }, [check])

  const stepColors = {
    [STEP.CHECKING]: { bg: 'rgba(51,102,246,0.10)', border: 'rgba(51,102,246,0.25)' },
    [STEP.WAITING]: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' },
    [STEP.DONE]: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)' },
    [STEP.ERROR]: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)' },
  }

  const c = stepColors[step]

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden"
      style={{ background: '#080c18' }}
    >
      {/* Background orbs */}
      <div style={{
        position: 'absolute', width: 600, height: 600,
        borderRadius: '50%', background: 'rgba(51,102,246,0.12)',
        filter: 'blur(90px)', top: -150, left: -100, pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', width: 500, height: 500,
        borderRadius: '50%', background: 'rgba(139,92,246,0.10)',
        filter: 'blur(90px)', bottom: -100, right: -80, pointerEvents: 'none'
      }} />

      <div className="w-full max-w-md relative z-10 animate-slide-up">

        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex w-16 h-16 rounded-2xl items-center justify-center mb-5"
            style={{
              background: 'linear-gradient(135deg,#3366f6,#7c3aed)',
              boxShadow: '0 0 40px rgba(51,102,246,0.5)'
            }}
          >
            <Shield size={30} className="text-white" />
          </div>
          <h1 className="font-display font-bold text-3xl text-white mb-2">
            D365 Power Kit
          </h1>
          <p style={{ color: 'rgba(160,174,220,0.5)', fontSize: 13 }}>
            Open source · Secure · MIT License
          </p>
        </div>

        {/* Main card */}
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(30px)',
            border: '1px solid rgba(255,255,255,0.10)'
          }}
        >
          {/* Status box */}
          <div
            className="rounded-xl p-4 text-center"
            style={{ background: c.bg, border: `1px solid ${c.border}` }}
          >
            <div className="flex justify-center mb-3">
              {step === STEP.CHECKING && (
                <Loader size={24} className="animate-spin" style={{ color: '#93b4ff' }} />
              )}
              {step === STEP.WAITING && (
                <Loader size={24} className="animate-spin" style={{ color: '#fcd34d' }} />
              )}
              {step === STEP.DONE && (
                <CheckCircle size={24} style={{ color: '#6ee7b7' }} />
              )}
              {step === STEP.ERROR && (
                <AlertCircle size={24} style={{ color: '#fca5a5' }} />
              )}
            </div>

            <h3 style={{
              fontWeight: 600, color: 'rgba(240,244,255,0.9)',
              fontSize: 15, marginBottom: 6
            }}>
              {step === STEP.CHECKING && 'Detecting D365 session...'}
              {step === STEP.WAITING && 'Waiting for D365 tab'}
              {step === STEP.DONE && 'Connected!'}
              {step === STEP.ERROR && 'Connection failed'}
            </h3>

            <p style={{
              fontSize: 12, color: 'rgba(160,174,220,0.6)', lineHeight: 1.6
            }}>
              {step === STEP.CHECKING && 'Checking if your D365 org is open...'}
              {step === STEP.WAITING && `Open your D365 org in Chrome. Checking every 5s... (${pollCount})`}
              {step === STEP.DONE && orgUrl}
              {step === STEP.ERROR && error}
            </p>

            {step === STEP.WAITING && (
              <button
                onClick={() => chrome.tabs?.create({ url: 'https://make.powerapps.com' })}
                className="flex items-center gap-2 mx-auto mt-3 px-3 py-1.5 rounded-xl text-xs"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(160,174,220,0.8)'
                }}
              >
                <ExternalLink size={12} />
                Open Power Apps
              </button>
            )}

            {step === STEP.ERROR && (
              <button
                onClick={() => window.location.reload()}
                className="btn-primary mx-auto mt-3 text-xs px-4 py-1.5"
              >
                Try Again
              </button>
            )}
          </div>

          {/* How it works */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16
          }}>
            <p style={{
              fontSize: 10, color: 'rgba(160,174,220,0.35)',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12
            }}>
              How it works
            </p>
            {[
              'Open your D365 org in any Chrome tab',
              'Come back here and click the extension icon',
              'Extension detects your session automatically',
              'No password or token needed — uses your existing login',
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-3 mb-2.5">
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs"
                  style={{ background: 'rgba(51,102,246,0.2)', color: '#93b4ff' }}
                >
                  {i + 1}
                </span>
                <span style={{
                  fontSize: 12, color: 'rgba(160,174,220,0.6)', lineHeight: 1.5
                }}>
                  {s}
                </span>
              </div>
            ))}
          </div>

          {/* Security note */}
          <div
            className="flex items-start gap-3 p-3 rounded-xl"
            style={{
              background: 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.12)'
            }}
          >
            <Lock size={13} style={{ color: '#6ee7b7', marginTop: 2, flexShrink: 0 }} />
            <p style={{ fontSize: 11, color: 'rgba(110,231,183,0.65)', lineHeight: 1.6 }}>
              Uses your existing D365 browser session — same as how D365 itself works.
              No credentials stored. No tokens. Works via secure cookie auth.
            </p>
          </div>

          {/* Feedback */}
          <div className="text-center">
            <p style={{ fontSize: 11, color: 'rgba(160,174,220,0.3)' }}>
              Having issues? Open the Debug page for diagnostics.
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}