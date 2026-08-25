import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import RootSidebar from './root_component/RootSidebar'

// Shared shell for every admin/root page (/, is intentionally NOT here — see
// the routing rule in App.tsx). Wraps whichever page is active with one
// persistent sidebar, and keeps every page the user has visited mounted
// (just hidden) so switching between them via the sidebar restores exactly
// where they left off — scroll position, open filters, already-fetched data
// — instead of remounting and re-fetching from scratch each time.
export default function AdminLayout() {
    const location = useLocation()
    const outlet = useOutlet()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [pages, setPages] = useState<Record<string, ReactNode>>({})

    useEffect(() => {
        setPages(prev => ({ ...prev, [location.pathname]: outlet }))
    }, [location.pathname, outlet])

    return (
        <div className="flex min-h-screen">
            <RootSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 min-w-0 flex flex-col">
                {/* Mobile top bar — the sidebar itself carries the logo/nav on md+ */}
                <div
                    className="md:hidden px-4 py-3 flex items-center gap-3 sticky top-0 z-20"
                    style={{ backgroundColor: 'var(--vault-panel)', borderBottom: '1px solid var(--vault-hairline)' }}
                >
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-1.5 -ml-1.5 rounded-lg shrink-0"
                        style={{ color: 'var(--vault-brass)' }}
                        aria-label="เปิดเมนู"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <img src="/Ex_logo_6.png" alt="Peter Exchange" className="h-6 w-auto shrink-0" />
                </div>

                <div className="flex-1 min-w-0">
                    {Object.entries(pages).map(([path, node]) => (
                        <div key={path} style={{ display: path === location.pathname ? 'contents' : 'none' }}>
                            {node}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
