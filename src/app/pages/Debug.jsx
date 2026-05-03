import React, { useState } from 'react'
import { useAuthStore } from '../store/authStore'

function sendMsg(message) {
  return new Promise((resolve, reject) => {
    if (!chrome?.runtime?.sendMessage) {
      reject(new Error('No Chrome API'))
      return
    }
    chrome.runtime.sendMessage(message, (res) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
      else resolve(res)
    })
  })
}

export default function DebugPage() {
  const { checkAuth, orgUrl, authenticated } = useAuthStore()
  const [result,     setResult]     = useState(null)
  const [apiResult,  setApiResult]  = useState(null)
  const [apiLoading, setApiLoading] = useState(false)

  const checkStatus = async () => {
    const res = await sendMsg({ type: 'GET_AUTH_STATUS' })
    setResult(JSON.stringify(res, null, 2))
    await checkAuth()
  }

  const clearSession = async () => {
    const res = await sendMsg({ type: 'CLEAR_SESSION' })
    setResult(JSON.stringify(res, null, 2))
    await checkAuth()
  }

  const testApi = async () => {
    setApiLoading(true)
    setApiResult(null)
    try {
      const res = await sendMsg({
        type:    'D365_API_REQUEST',
        payload: {
          method: 'GET',
          path: 'api/data/v9.0/accounts?$top=3&$select=name,accountid',
        },
      })
      setApiResult(JSON.stringify(res, null, 2))
    } catch (err) {
      setApiResult('ERROR: ' + err.message)
    } finally {
      setApiLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl animate-fade-in">

      <div>
        <h1 className="font-display font-bold text-2xl text-white mb-1">
          Debug Panel
        </h1>
        <p style={{ color:'rgba(160,174,220,0.5)', fontSize:13 }}>
          Test connection to your D365 org
        </p>
      </div>

      {/* Status */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-white">Current Status</h2>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full"
            style={{ background: authenticated ? '#10b981' : '#f59e0b' }} />
          <span style={{ color:'rgba(160,174,220,0.8)', fontSize:13 }}>
            {authenticated
              ? `Connected — ${orgUrl}`
              : 'Not connected — open your D365 org in Chrome'}
          </span>
        </div>
        <div className="flex gap-3">
          <button onClick={checkStatus} className="btn-secondary text-xs px-3 py-1.5">
            Refresh Status
          </button>
          <button onClick={clearSession} className="btn-danger text-xs px-3 py-1.5">
            Clear Session
          </button>
        </div>
        {result && (
          <pre style={{ fontSize:11, color:'#6ee7b7', fontFamily:'monospace',
            whiteSpace:'pre-wrap', wordBreak:'break-all' }}>
            {result}
          </pre>
        )}
      </div>

      {/* API Test */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-white">Test API Connection</h2>
        <p style={{ color:'rgba(160,174,220,0.5)', fontSize:12, lineHeight:1.6 }}>
          Fetches top 5 entities from your D365 org.
          Make sure your D365 tab is open in Chrome!
        </p>
        <button
          onClick={testApi}
          disabled={apiLoading || !authenticated}
          className="btn-primary w-full">
          {apiLoading ? 'Testing...' : 'Test D365 API Connection'}
        </button>
        {!authenticated && (
          <p style={{ fontSize:11, color:'rgba(252,211,77,0.6)',
            textAlign:'center' }}>
            Connect to D365 first before testing API
          </p>
        )}
        {apiResult && (
          <pre style={{ fontSize:11, color:'#6ee7b7', fontFamily:'monospace',
            whiteSpace:'pre-wrap', wordBreak:'break-all',
            maxHeight:300, overflow:'auto' }}>
            {apiResult}
          </pre>
        )}
      </div>

      {/* Feedback */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-white">Report an Issue</h2>
        <p style={{ color:'rgba(160,174,220,0.5)', fontSize:12, lineHeight:1.6 }}>
          If the extension is not working, please raise a ticket with the details below.
        </p>
        <button
          onClick={() => window.open('https://github.com/issues/new', '_blank')}
          className="btn-secondary w-full text-xs">
          Open GitHub Issue
        </button>
      </div>

    </div>
  )
}