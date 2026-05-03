import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './styles/globals.css'
import { GOOGLE_FONTS_URL } from './globals/fonts/index.js'

// Load Google Fonts dynamically
const link = document.createElement('link')
link.rel  = 'stylesheet'
link.href = GOOGLE_FONTS_URL
document.head.appendChild(link)

// Console warning — security/branding
console.log(
  '%c D365 Attribute Manager ',
  'background:#3366f6;color:#fff;font-size:14px;font-weight:bold;padding:4px 8px;border-radius:4px;'
)
console.log(
  '%c⚠️  Stop! This is a browser feature for developers.',
  'color:#f59e0b;font-size:13px;font-weight:bold;'
)
console.log(
  '%c If someone told you to paste something here, it is a scam.',
  'color:#ef4444;font-size:12px;'
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background:   'var(--glass2)',
            color:        'var(--text-primary)',
            border:       '1px solid var(--glass-border)',
            borderRadius: '10px',
            fontSize:     '13px',
            backdropFilter: 'blur(20px)',
          },
          success: { iconTheme: { primary: 'var(--success)', secondary: 'var(--success-bg)' } },
          error:   { iconTheme: { primary: 'var(--danger)',  secondary: 'var(--danger-bg)'  } },
        }}
      />
    </HashRouter>
  </React.StrictMode>
)