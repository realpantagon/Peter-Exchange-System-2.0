import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getRates, updateRate, refreshSuperrichRates, getSuperrichLatest, type SuperrichRate } from '../lib/api'
import { getFlagIcon } from '../utils/currencyUtils'
import type { PeterExchangeRate } from '../types/database'

// Super Rich rates span 0.02 (KRW) to 44 (GBP) — adapt precision to magnitude.
const formatSR = (v: number | null | undefined) => {
  if (v === null || v === undefined) return '-'
  const abs = Math.abs(v)
  const digits = abs >= 100 ? 2 : abs >= 1 ? 3 : 4
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export default function AdminPage() {
  const location = useLocation()
  const [rates, setRates] = useState<PeterExchangeRate[]>([])
  const [superrich, setSuperrich] = useState<Record<string, SuperrichRate>>({})
  const [srLoading, setSrLoading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // AdminLayout keeps this page mounted, so a plain []-effect would run only
  // once. Keying on the path re-runs every time the user navigates back here —
  // which is when we force a fresh Super Rich scrape.
  useEffect(() => {
    if (location.pathname !== '/admin2025') return
    let cancelled = false

    const load = async () => {
      // Our own board rates (fast — always show these immediately)
      getRates().then(d => { if (!cancelled) setRates(d) }).catch(e => console.error('Failed to fetch rates', e))

      // Force a fresh Super Rich scrape → store → show. Falls back to the last
      // stored set if the scrape request itself fails.
      setSrLoading(true)
      try {
        const latest = await refreshSuperrichRates()
        if (!cancelled) setSuperrich(Object.fromEntries(latest.map(r => [r.code, r])))
      } catch {
        try {
          const stored = await getSuperrichLatest()
          if (!cancelled) setSuperrich(Object.fromEntries(stored.map(r => [r.code, r])))
        } catch (e) { console.error('Failed to fetch Super Rich rates', e) }
      } finally {
        if (!cancelled) setSrLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [location.pathname])

  const fetchRates = async () => {
    try {
      const data = await getRates()
      setRates(data)
    } catch (error) {
      console.error("Failed to fetch rates", error)
    }
  }

  const startEdit = (rate: PeterExchangeRate) => {
    setEditingId(rate.id)
    setEditValue(rate.Rate || '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  const saveEdit = async (id: number) => {
    setLoading(true)
    try {
      await updateRate(id, editValue)
      await fetchRates()
      setEditingId(null)
      setEditValue('')
    } catch (error) {
      console.error('Failed to update rate:', error)
      alert('Failed to update rate')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="container mx-auto px-2 py-2 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold text-gray-800">ตั้งค่าเรท</h1>
          <div className="text-sm text-gray-500">
            {new Date().toLocaleDateString('en-GB')}{" "}
            {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow border border-gray-200 flex-1 flex flex-col max-w-md mx-auto w-full">
          {/* Header row */}
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 p-2 bg-gray-100 border-b border-gray-200 text-sm font-medium text-gray-700 items-center">
            <div className="px-1">Flag</div>
            <div className="px-1">Currency</div>
            <div className="px-1 flex flex-col items-center leading-none">
              <img src="/super-rich.jpeg" alt="Super Rich" className="h-5 w-auto rounded object-contain" />
              <span className="text-[9px] text-green-700 font-semibold mt-0.5">รับซื้อ</span>
            </div>
            <div className="px-1 text-right">Rate</div>
          </div>

          <div className="divide-y divide-gray-100 overflow-y-auto flex-1">
            {rates.map((rate) => {
              const sr = rate.Cur ? superrich[rate.Cur] : undefined
              return (
                <div key={rate.id} className={`${editingId === rate.id ? 'bg-blue-50 p-3 border-2 border-blue-300' : 'grid grid-cols-[auto_1fr_auto_auto] gap-2 px-2 py-1 items-center hover:bg-gray-50'} transition-all`}>
                  {editingId === rate.id ? (
                    // Expanded edit mode layout
                    <div className="space-y-3">
                      {/* Currency info + Super Rich reference */}
                      <div className="flex items-center gap-3">
                        <img
                          src={getFlagIcon(rate.Cur || '')}
                          alt={`${rate.Cur} flag`}
                          className="w-8 h-8 rounded-full object-cover"
                          onError={(e) => { e.currentTarget.src = '/vite.svg' }}
                        />
                        <span className="font-semibold text-base text-gray-800">{rate.Cur}</span>
                        {sr && (
                          <span className="ml-auto text-sm font-mono font-semibold text-green-600 flex items-center gap-1">
                            <img src="/super-rich.jpeg" alt="Super Rich" className="h-4 w-auto rounded object-contain" />
                            {formatSR(sr.buying)}
                          </span>
                        )}
                      </div>

                      {/* Input field */}
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Exchange Rate</label>
                        <input
                          type="number"
                          inputMode="decimal"
                          pattern="[0-9]*\.?[0-9]*"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="border border-blue-300 rounded px-3 py-2 w-full text-right font-mono text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(rate.id)
                            if (e.key === 'Escape') cancelEdit()
                          }}
                          autoFocus
                          placeholder="e.g. 30.00"
                          step="0.01"
                        />
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(rate.id)}
                          disabled={loading}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium disabled:opacity-50"
                        >
                          {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={loading}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Normal compact view
                    <>
                      {/* Flag */}
                      <div className="flex justify-center">
                        <img
                          src={getFlagIcon(rate.Cur || '')}
                          alt={`${rate.Cur} flag`}
                          className="w-6 h-6 rounded-full object-cover"
                          onError={(e) => { e.currentTarget.src = '/vite.svg' }}
                        />
                      </div>

                      {/* Currency */}
                      <div className="font-medium text-sm text-gray-800">{rate.Cur}</div>

                      {/* Super Rich buying (green) */}
                      <div className="px-1 text-right font-mono text-sm font-semibold text-green-600 tabular-nums min-w-[52px]">
                        {sr ? formatSR(sr.buying) : (srLoading ? <span className="text-gray-300">…</span> : <span className="text-gray-300">-</span>)}
                      </div>

                      {/* Rate + edit button */}
                      <div className="flex items-center justify-end space-x-2">
                        <span className="font-mono text-sm">{rate.Rate}</span>
                        <button
                          onClick={() => startEdit(rate)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                        >
                          ✎
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
