import React from 'react'
import { Palette, Check } from 'lucide-react'
import { useThemeStore } from '../store/themeStore'
import { THEMES } from '../globals/themes/index.js'
import { APP_NAME, APP_VERSION, GITHUB_URL } from '../globals/constants.js'

export default function SettingsPage() {
  const { themeId, setTheme } = useThemeStore()

  return (
    <div className="space-y-6 max-w-2xl animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-2xl mb-1"
          style={{ color: 'var(--text-primary)' }}>
          Settings
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          Customize your experience
        </p>
      </div>

      {/* Theme */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <Palette size={18} style={{ color: 'var(--text-accent)' }} />
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            Theme
          </h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
          Choose your preferred appearance. More themes coming in future updates.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {Object.values(THEMES).map((theme) => {
            const isActive = themeId === theme.id
            return (
              <button
                key={theme.id}
                onClick={() => setTheme(theme.id)}
                className="flex items-center justify-between p-4 rounded-xl transition-all duration-200"
                style={{
                  background:   isActive ? 'var(--accent-bg)'   : 'var(--glass1)',
                  border:       `1px solid ${isActive ? 'var(--accent-border)' : 'var(--glass-border)'}`,
                  cursor:       'pointer',
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.background = 'var(--glass2)'
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.background = 'var(--glass1)'
                }}
              >
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 22 }}>{theme.emoji}</span>
                  <div className="text-left">
                    <p className="font-medium text-sm"
                      style={{ color: 'var(--text-primary)' }}>
                      {theme.label}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {theme.id === 'dark' ? 'Glassmorphism dark' : 'Glassmorphism light'}
                    </p>
                  </div>
                </div>
                {isActive && (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--accent-primary)' }}>
                    <Check size={12} className="text-white" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* About */}
      <div className="card space-y-3">
        <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          About
        </h2>
        <div className="space-y-2">
          {[
            ['Extension', APP_NAME],
            ['Version',   APP_VERSION],
            ['License',   'MIT — Open Source'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{value}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => window.open(GITHUB_URL, '_blank')}
          className="btn-secondary w-full text-xs mt-2">
          View on GitHub
        </button>
      </div>

    </div>
  )
}