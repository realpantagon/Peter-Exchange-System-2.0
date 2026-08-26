import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { Link, useLocation } from 'react-router-dom'

// Fixed list of stores in the transaction system: ร้าน 4 และ ร้าน 11
const BRANCHES = ['4', '11']

const NAV_ITEMS: { to: string; label: string; icon: (props: { className?: string }) => JSX.Element }[] = [
    {
        to: '/root', label: 'ภาพรวม', icon: (p) => (
            <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 9.75L12 3l9 6.75V21a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75v-5.25a.75.75 0 00-.75-.75h-4.5a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75h-4.5A.75.75 0 013 21V9.75z" /></svg>
        )
    },
    {
        to: '/root/daily', label: 'รายละเอียดรายวัน', icon: (p) => (
            <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        )
    },
    {
        to: '/admin2025', label: 'ตั้งค่าเรท', icon: (p) => (
            <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6.375 6.375h.008v.008h-.008V6.375z" /></svg>
        )
    },
    {
        to: '/rate-history', label: 'ประวัติเรท', icon: (p) => (
            <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 3v18h18M7 14l3-3 3 3 5-6" /></svg>
        )
    },
    {
        to: '/sales-forecast', label: 'ทำนายยอดขาย', icon: (p) => (
            <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
        )
    },
    {
        to: '/superadmin2025', label: 'ซูเปอร์แอดมิน', icon: (p) => (
            <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
        )
    },
]

export default function RootSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const location = useLocation()
    const [launchOpen, setLaunchOpen] = useState(false)
    const launchRef = useRef<HTMLDivElement>(null)

    // Close the branch-launch dropdown on an outside click, and whenever the
    // sidebar itself closes (mobile drawer dismissed).
    useEffect(() => {
        if (!launchOpen) return
        const handleClick = (e: MouseEvent) => {
            if (launchRef.current && !launchRef.current.contains(e.target as Node)) {
                setLaunchOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [launchOpen])

    useEffect(() => {
        if (!isOpen) setLaunchOpen(false)
    }, [isOpen])

    return (
        <>
            {/* Backdrop — mobile only, closes the drawer on tap-outside */}
            <div
                className={`fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
                aria-hidden="true"
            />

            <aside
                className={`fixed inset-y-0 left-0 z-40 w-72 flex flex-col transform transition-transform duration-300 ease-out md:static md:z-auto md:w-64 md:translate-x-0 md:shrink-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
                style={{ backgroundColor: 'var(--vault-panel)', borderRight: '1px solid var(--vault-hairline)' }}
            >
                {/* Logo row */}
                <div className="flex items-center justify-between gap-3 px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--vault-hairline)' }}>
                    <div className="flex items-center min-w-0">
                        <img src="/Ex_logo_6.png" alt="Peter Exchange" className="h-8 w-auto" />
                    </div>
                    <button
                        onClick={onClose}
                        className="md:hidden p-1.5 rounded-lg shrink-0"
                        style={{ color: 'var(--vault-muted)' }}
                        aria-label="ปิดเมนู"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
                    {NAV_ITEMS.map(item => {
                        const isActive = location.pathname === item.to
                        return (
                            <Link
                                key={item.to}
                                to={item.to}
                                onClick={onClose}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                                style={{
                                    color: isActive ? 'var(--vault-brass)' : 'var(--vault-muted)',
                                    backgroundColor: isActive ? 'var(--vault-brass-faint)' : 'transparent',
                                }}
                                onMouseEnter={(e) => {
                                    if (isActive) return
                                    e.currentTarget.style.color = 'var(--vault-paper)'
                                    e.currentTarget.style.backgroundColor = 'var(--vault-panel-raised)'
                                }}
                                onMouseLeave={(e) => {
                                    if (isActive) return
                                    e.currentTarget.style.color = 'var(--vault-muted)'
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                            >
                                <item.icon className="w-4.5 h-4.5 shrink-0" />
                                <span>{item.label}</span>
                            </Link>
                        )
                    })}
                </nav>

                {/* Quick launch — open POS per branch, tucked away at the bottom */}
                <div ref={launchRef} className="relative px-4 py-4 shrink-0" style={{ borderTop: '1px solid var(--vault-hairline)' }}>
                    {launchOpen && (
                        <div
                            className="absolute left-4 right-4 bottom-full mb-2 rounded-lg overflow-hidden shadow-lg"
                            style={{ backgroundColor: 'var(--vault-panel)', border: '1px solid var(--vault-hairline)' }}
                        >
                            {BRANCHES.map(b => (
                                <Link
                                    key={b}
                                    to={`/system2025?branchid=${b}`}
                                    onClick={() => { setLaunchOpen(false); onClose() }}
                                    className="flex items-center gap-2 px-3.5 py-2.5 text-sm font-bold transition-colors"
                                    style={{ color: 'var(--vault-brass)' }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--vault-panel-raised)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                    เปิดระบบ ร้าน {b}
                                </Link>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={() => setLaunchOpen(v => !v)}
                        className="w-full flex items-center justify-between gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors opacity-60 hover:opacity-100"
                        style={{ color: 'var(--vault-muted)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--vault-panel-raised)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                        <span className="flex items-center gap-2">
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            เปิดระบบขาย
                        </span>
                        <svg className={`w-3.5 h-3.5 shrink-0 transition-transform ${launchOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>
            </aside>
        </>
    )
}
