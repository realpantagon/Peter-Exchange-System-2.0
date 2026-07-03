import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
    getBalanceLogs,
    createBalanceLog,
    updateBalanceLog,
    deleteBalanceLog,
} from '../../lib/api'
import type { PeterExchangeBalanceLog } from '../../types/database'
import type { Transaction } from '../../utils/currencyUtils'

interface DailyCashFlowProps {
    transactions: Transaction[]
    notify?: (message: string, type: 'success' | 'error' | 'info') => void
    // When set, scope the whole card to a single branch (e.g. staff on /system2025).
    branchId?: string | null
    // When set, the date is controlled by the parent and the internal picker is hidden.
    date?: string
    // Root pages pass true → may edit/delete existing entries. Staff (default) can only append.
    isRoot?: boolean
}

const formatTHB = (value: number) =>
    new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(value)

// Local 'YYYY-MM-DD' for a date
const toISODate = (d: Date) => d.toLocaleDateString('en-CA') // en-CA => YYYY-MM-DD

const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

interface Flow { thbIn: number; thbOut: number }

export default function DailyCashFlow({ transactions, notify, branchId, date, isRoot = false }: DailyCashFlowProps) {
    const [internalDate, setInternalDate] = useState<string>(toISODate(new Date()))
    const selectedDate = date ?? internalDate
    const [logs, setLogs] = useState<PeterExchangeBalanceLog[]>([])
    const [loading, setLoading] = useState(true)

    const branches = useMemo(() => {
        if (branchId) return [branchId]
        return Array.from(new Set(transactions.map(t => t.Branch).filter(Boolean))).sort() as string[]
    }, [transactions, branchId])

    // Per-branch cash movement for the selected date
    const flows = useMemo(() => {
        const map: { [branch: string]: Flow } = {}
        branches.forEach(b => (map[b] = { thbIn: 0, thbOut: 0 }))

        transactions.forEach(t => {
            if (!t.created_at || !t.Branch) return
            if (branchId && t.Branch !== branchId) return
            if (toISODate(new Date(t.created_at)) !== selectedDate) return
            if (!map[t.Branch]) map[t.Branch] = { thbIn: 0, thbOut: 0 }

            const total = Math.abs(parseFloat(t.Total_TH || '0') || 0)
            if (t.Transaction_Type === 'Selling') map[t.Branch].thbIn += total
            else map[t.Branch].thbOut += total
        })
        return map
    }, [transactions, branches, selectedDate, branchId])

    const loadLogs = useCallback(async () => {
        setLoading(true)
        const rows = await getBalanceLogs(selectedDate, branchId || undefined)
        setLogs(rows)
        setLoading(false)
    }, [selectedDate, branchId])

    useEffect(() => { loadLogs() }, [loadLogs])

    const isToday = selectedDate === toISODate(new Date())

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-gradient-to-r from-amber-50 to-white border-b border-amber-100">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                            กระแสเงินสดรายวัน
                            {isToday && <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-[10px] font-bold">วันนี้</span>}
                        </h3>
                        <p className="text-[11px] text-gray-500">
                            {isRoot ? 'โหมด Root · แก้ไข/ลบได้ทุกรายการ' : 'บันทึกแล้วล็อกทันที · แก้ไขได้เฉพาะ Root'}
                        </p>
                    </div>
                </div>

                {date === undefined && (
                    <input
                        type="date"
                        value={selectedDate}
                        max={toISODate(new Date())}
                        onChange={(e) => setInternalDate(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                )}
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6 space-y-5">
                {loading ? (
                    <div className="text-sm text-gray-400 py-8 text-center">กำลังโหลด...</div>
                ) : branches.length === 0 ? (
                    <div className="text-sm text-gray-400 py-8 text-center">ไม่มีข้อมูลร้านในช่วงที่ดึงมา</div>
                ) : (
                    branches.map(b => (
                        <BranchCashPanel
                            key={b}
                            branch={b}
                            date={selectedDate}
                            flow={flows[b] || { thbIn: 0, thbOut: 0 }}
                            logs={logs.filter(l => l.Branch === b)}
                            isRoot={isRoot}
                            notify={notify}
                            onChanged={loadLogs}
                        />
                    ))
                )}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------

interface BranchCashPanelProps {
    branch: string
    date: string
    flow: Flow
    logs: PeterExchangeBalanceLog[]
    isRoot: boolean
    notify?: (message: string, type: 'success' | 'error' | 'info') => void
    onChanged: () => void
}

function BranchCashPanel({ branch, date, flow, logs, isRoot, notify, onChanged }: BranchCashPanelProps) {
    const [openAmt, setOpenAmt] = useState('')
    const [closeAmt, setCloseAmt] = useState('')
    const [showNew, setShowNew] = useState(false)
    const [saving, setSaving] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editValue, setEditValue] = useState('')

    const openings = useMemo(() => logs.filter(l => l.Kind === 'opening'), [logs])
    const closings = useMemo(() => logs.filter(l => l.Kind === 'closing'), [logs])
    const dayNet = flow.thbIn - flow.thbOut

    // Pair opening[i] ↔ closing[i] into rounds (opening always leads within a round)
    const rounds = openings.map((op, i) => ({ opening: op, closing: closings[i] ?? null }))
    const allComplete = openings.length === closings.length          // every round has both halves (0===0 too)
    const awaitingIndex = allComplete ? -1 : openings.length - 1     // last round waiting for its closing

    // Where does the "new opening" input go?
    const showFirstOpening = allComplete && openings.length === 0    // very first round → show directly
    const showAddedOpening = allComplete && openings.length > 0 && showNew
    const showAddButton = allComplete && openings.length > 0 && !showNew

    // Expected closing for the round currently awaiting a close
    const awaitingOpening = awaitingIndex >= 0 ? Number(openings[awaitingIndex].Amount || 0) : 0
    const expectedClosing = awaitingOpening + dayNet
    const closeParsed = parseFloat(closeAmt)
    const closePreviewDiff = !isNaN(closeParsed) ? closeParsed - expectedClosing : null

    const saveOpening = async () => {
        const v = parseFloat(openAmt)
        if (isNaN(v)) { notify?.('กรุณากรอกจำนวนเงินเปิด', 'error'); return }
        setSaving(true)
        try {
            await createBalanceLog({ Date: date, Branch: branch, Kind: 'opening', Amount: v, System_Snapshot: null })
            setOpenAmt(''); setShowNew(false)
            notify?.('บันทึกเงินเปิดแล้ว (ล็อก)', 'success')
            onChanged()
        } catch {
            notify?.('บันทึกไม่สำเร็จ — ตรวจสอบตาราง Peter_Exchange_Balance_Log', 'error')
        } finally { setSaving(false) }
    }

    const saveClosing = async () => {
        const v = parseFloat(closeAmt)
        if (isNaN(v)) { notify?.('กรุณากรอกจำนวนเงินปิด', 'error'); return }
        setSaving(true)
        try {
            await createBalanceLog({ Date: date, Branch: branch, Kind: 'closing', Amount: v, System_Snapshot: expectedClosing })
            setCloseAmt('')
            notify?.('บันทึกเงินปิดแล้ว (ล็อก)', 'success')
            onChanged()
        } catch {
            notify?.('บันทึกไม่สำเร็จ — ตรวจสอบตาราง Peter_Exchange_Balance_Log', 'error')
        } finally { setSaving(false) }
    }

    const startEdit = (l: PeterExchangeBalanceLog) => { setEditingId(l.id); setEditValue(String(l.Amount)) }
    const saveEdit = async (l: PeterExchangeBalanceLog) => {
        const v = parseFloat(editValue)
        if (isNaN(v)) { notify?.('จำนวนเงินไม่ถูกต้อง', 'error'); return }
        try {
            await updateBalanceLog(l.id, { Amount: v })
            setEditingId(null); notify?.('แก้ไขรายการเรียบร้อย', 'success'); onChanged()
        } catch { notify?.('แก้ไขไม่สำเร็จ', 'error') }
    }
    const removeEntry = async (l: PeterExchangeBalanceLog) => {
        if (!window.confirm(`ลบรายการ ${l.Kind === 'opening' ? 'เงินเปิด' : 'เงินปิด'} ฿${formatTHB(Number(l.Amount))} ?`)) return
        try { await deleteBalanceLog(l.id); notify?.('ลบรายการเรียบร้อย', 'success'); onChanged() }
        catch { notify?.('ลบไม่สำเร็จ', 'error') }
    }

    // Renders a locked entry cell (amount + time + lock / root controls)
    const LockedEntry = ({ l }: { l: PeterExchangeBalanceLog }) => {
        if (editingId === l.id) {
            return (
                <div className="flex items-center gap-1.5">
                    <input
                        type="number" value={editValue} autoFocus
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-28 px-2 py-1 rounded-lg border border-gray-300 text-right text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button onClick={() => saveEdit(l)} className="px-2 py-1 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700">✓</button>
                    <button onClick={() => setEditingId(null)} className="px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs hover:bg-gray-200">✕</button>
                </div>
            )
        }
        return (
            <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-gray-900 tabular-nums">฿{formatTHB(Number(l.Amount))}</span>
                <span className="text-[10px] text-gray-400">{formatTime(l.created_at)} น.</span>
                {isRoot ? (
                    <span className="flex items-center gap-0.5">
                        <button onClick={() => startEdit(l)} title="แก้ไข" className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => removeEntry(l)} title="ลบ" className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </span>
                ) : (
                    <span title="ล็อกแล้ว — แก้ไขได้เฉพาะ Root" className="text-gray-300">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </span>
                )}
            </div>
        )
    }

    const totalRounds = rounds.length + (showFirstOpening || showAddedOpening ? 1 : 0)

    return (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
            {/* Branch header with day flow */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <span className="font-bold text-gray-800 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">{branch}</span>
                    ร้าน {branch}
                </span>
                <span className="text-xs text-gray-500 flex items-center gap-3">
                    <span className="text-green-600">รับ +฿{formatTHB(flow.thbIn)}</span>
                    <span className="text-red-600">จ่าย −฿{formatTHB(flow.thbOut)}</span>
                    <span className={dayNet >= 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                        สุทธิ {dayNet >= 0 ? '+' : '−'}฿{formatTHB(Math.abs(dayNet))}
                    </span>
                </span>
            </div>

            <div className="p-3 space-y-3">
                {/* Persisted rounds */}
                {rounds.map((r, i) => {
                    const isAwaiting = i === awaitingIndex
                    const diff = r.closing ? Number(r.closing.Amount || 0) - Number(r.closing.System_Snapshot ?? 0) : null
                    return (
                        <RoundCard
                            key={r.opening.id}
                            index={i + 1}
                            left={<LockedEntry l={r.opening} />}
                            right={
                                r.closing ? (
                                    <div className="space-y-1">
                                        <LockedEntry l={r.closing} />
                                        {diff !== null && (
                                            <div className={`text-[11px] font-medium ${diff === 0 ? 'text-green-600' : diff > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                                ระบบคิด ฿{formatTHB(Number(r.closing.System_Snapshot ?? 0))} ·{' '}
                                                {diff === 0 ? 'ตรงระบบ ✓' : `${diff > 0 ? 'เกิน +' : 'ขาด −'}฿${formatTHB(Math.abs(diff))}`}
                                            </div>
                                        )}
                                    </div>
                                ) : isAwaiting ? (
                                    <ClosingInput
                                        value={closeAmt}
                                        onChange={setCloseAmt}
                                        onSave={saveClosing}
                                        saving={saving}
                                        expected={expectedClosing}
                                        previewDiff={closePreviewDiff}
                                    />
                                ) : (
                                    <span className="text-xs text-gray-300">—</span>
                                )
                            }
                            complete={!!r.closing}
                        />
                    )
                })}

                {/* New round opening input (first round, or after pressing +) */}
                {(showFirstOpening || showAddedOpening) && (
                    <RoundCard
                        index={totalRounds}
                        left={
                            <OpeningInput value={openAmt} onChange={setOpenAmt} onSave={saveOpening} saving={saving} />
                        }
                        right={<span className="text-xs text-gray-300">บันทึกเงินเปิดก่อน</span>}
                        complete={false}
                    />
                )}

                {/* Add-new-round button (only when the latest round is complete) */}
                {showAddButton && (
                    <button
                        onClick={() => setShowNew(true)}
                        className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50/50 transition-colors flex items-center justify-center gap-1.5"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        เพิ่มรอบเปิด–ปิดใหม่ของวันนี้
                    </button>
                )}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------

// One round = opening (left) paired with closing (right)
function RoundCard({ index, left, right, complete }: { index: number; left: ReactNode; right: ReactNode; complete: boolean }) {
    return (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50/70 border-b border-gray-100">
                <span className="text-[11px] font-semibold text-gray-500">รอบที่ {index}</span>
                {complete
                    ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">ครบแล้ว</span>
                    : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">รอบันทึก</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
                <div className="p-3 bg-blue-50/30">
                    <div className="text-[11px] font-semibold text-blue-700 mb-1.5 flex items-center gap-1">☀️ เงินเปิด</div>
                    {left}
                </div>
                <div className="p-3 bg-amber-50/30">
                    <div className="text-[11px] font-semibold text-amber-700 mb-1.5 flex items-center gap-1">🌙 เงินปิด</div>
                    {right}
                </div>
            </div>
        </div>
    )
}

function OpeningInput({ value, onChange, onSave, saving }: { value: string; onChange: (v: string) => void; onSave: () => void; saving: boolean }) {
    return (
        <div className="flex items-center gap-2">
            <input
                type="number" inputMode="decimal" value={value} placeholder="จำนวนเงินเปิด"
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !saving) onSave() }}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={onSave} disabled={saving} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
                ☀️ บันทึกเปิด
            </button>
        </div>
    )
}

function ClosingInput({ value, onChange, onSave, saving, expected, previewDiff }: {
    value: string; onChange: (v: string) => void; onSave: () => void; saving: boolean; expected: number; previewDiff: number | null
}) {
    return (
        <div>
            <div className="flex items-center gap-2">
                <input
                    type="number" inputMode="decimal" value={value} placeholder="นับเงินจริง"
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !saving) onSave() }}
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 text-right focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button onClick={onSave} disabled={saving} className="px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 whitespace-nowrap">
                    🌙 บันทึกปิด
                </button>
            </div>
            <div className="mt-1 text-[11px] text-gray-500">
                ระบบคิด ฿{formatTHB(expected)}
                {previewDiff !== null && previewDiff !== 0 && (
                    <span className={previewDiff > 0 ? 'text-blue-600 font-medium' : 'text-red-600 font-medium'}>
                        {' '}· {previewDiff > 0 ? 'เกิน +' : 'ขาด −'}฿{formatTHB(Math.abs(previewDiff))}
                    </span>
                )}
                {previewDiff === 0 && <span className="text-green-600 font-medium"> · ตรงระบบ ✓</span>}
            </div>
        </div>
    )
}
