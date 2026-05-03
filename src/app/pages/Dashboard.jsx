import React from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusSquare, Trash2, Download, ScrollText, Shield, Zap, ArrowRight } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

const FEATURES = [
  { to:'/bulk-create',   icon:PlusSquare, label:'Bulk Create Fields',  desc:'Create multiple attributes at once using an Excel template.',          badge:'Excel Template',    accent:{ bg:'rgba(51,102,246,0.10)',  border:'rgba(51,102,246,0.22)',  bbg:'rgba(51,102,246,0.18)',  bfg:'#93b4ff', ifg:'#93b4ff', hb:'rgba(51,102,246,0.45)' } },
  { to:'/bulk-delete',   icon:Trash2,     label:'Bulk Delete Fields',  desc:'Safely remove multiple attributes. Validation before every deletion.', badge:'Validation First',  accent:{ bg:'rgba(239,68,68,0.08)',   border:'rgba(239,68,68,0.18)',   bbg:'rgba(239,68,68,0.15)',   bfg:'#fca5a5', ifg:'#fca5a5', hb:'rgba(239,68,68,0.4)'   } },
  { to:'/export-schema', icon:Download,   label:'Export Schema',       desc:'Export entity metadata to a structured multi-sheet Excel workbook.',   badge:'Multi-sheet Excel', accent:{ bg:'rgba(16,185,129,0.07)',  border:'rgba(16,185,129,0.17)',  bbg:'rgba(16,185,129,0.14)',  bfg:'#6ee7b7', ifg:'#6ee7b7', hb:'rgba(16,185,129,0.38)'  } },
  { to:'/logs',          icon:ScrollText, label:'Operation Logs',      desc:'Tamper-evident audit log of all operations. Exportable to Excel.',     badge:'Exportable',        accent:{ bg:'rgba(245,158,11,0.07)', border:'rgba(245,158,11,0.17)', bbg:'rgba(245,158,11,0.14)', bfg:'#fcd34d', ifg:'#fcd34d', hb:'rgba(245,158,11,0.38)'  } },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const { orgUrl } = useAuthStore()

  return (
    <div className="space-y-7 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap size={13} style={{ color:'#93b4ff' }} />
          <span style={{ fontSize:11, fontFamily:'monospace', color:'#93b4ff', textTransform:'uppercase', letterSpacing:'0.1em' }}>D365 Attribute Manager</span>
        </div>
        <h1 className="font-display font-bold text-4xl text-white mb-2">What would you like to do?</h1>
        <p style={{ fontSize:13, color:'rgba(160,174,220,0.5)' }}>
          Connected to <span style={{ fontFamily:'monospace', color:'#93b4ff' }}>{orgUrl?.replace('https://','') || '—'}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {FEATURES.map(({ to, icon:Icon, label, desc, badge, accent }) => (
          <button key={to} onClick={() => navigate(to)}
            className="text-left p-5 rounded-2xl transition-all duration-200 group relative overflow-hidden"
            style={{ background:accent.bg, border:`1px solid ${accent.border}`, backdropFilter:'blur(20px)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor=accent.hb; e.currentTarget.style.transform='translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor=accent.border; e.currentTarget.style.transform='' }}>
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(255,255,255,0.04) 0%,transparent 60%)', pointerEvents:'none' }} />
            <div className="flex items-start justify-between mb-4 relative">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background:'rgba(0,0,0,0.25)', border:'1px solid rgba(255,255,255,0.06)' }}>
                <Icon size={18} style={{ color:accent.ifg }} />
              </div>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background:accent.bbg, color:accent.bfg }}>{badge}</span>
            </div>
            <h3 className="font-semibold text-white/90 mb-2 text-sm">{label}</h3>
            <p className="text-xs leading-relaxed" style={{ color:'rgba(160,174,220,0.5)' }}>{desc}</p>
            <div className="flex items-center gap-1 mt-4" style={{ color:accent.ifg, fontSize:11 }}>
              <span>Get started</span>
              <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl"
        style={{ background:'rgba(16,185,129,0.05)', border:'1px solid rgba(16,185,129,0.10)', backdropFilter:'blur(20px)' }}>
        <Shield size={14} style={{ color:'#6ee7b7', flexShrink:0 }} />
        <p style={{ fontSize:11, color:'rgba(110,231,183,0.55)', lineHeight:1.6 }}>
          All operations use your active D365 session token — AES-256 encrypted, in-memory only. No data sent to any external server.
        </p>
      </div>
    </div>
  )
}