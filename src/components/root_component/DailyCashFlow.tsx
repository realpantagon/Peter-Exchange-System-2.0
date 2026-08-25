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
    // When provided, the header itself becomes the expand/collapse trigger
    // (a chevron appears) instead of the body always rendering.
    collapsed?: boolean
    onToggleCollapsed?: () => void
}

const formatTHB = (value: number) =>
    new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(value)

// Local 'YYYY-MM-DD' for a date
const toISODate = (d: Date) => d.toLocaleDateString('en-CA') // en-CA => YYYY-MM-DD

const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

// Fuses an icon with its content into one atomic unit so flex-wrap can never
// strand the icon on its own line, separated from the amount it labels —
// only ever wraps together as a pair, at any width.
const withIcon = (icon: string, title: string, content: ReactNode) => (
    <span className="inline-flex items-start gap-1.5 min-w-0">
        <span className="text-sm shrink-0" title={title}>{icon}</span>
        <span className="min-w-0">{content}</span>
    </span>
)

interface Flow { thbIn: number; thbOut: number }

export default function DailyCashFlow({ transactions, notify, branchId, date, isRoot = false, collapsed = false, onToggleCollapsed }: DailyCashFlowProps) {
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
        <div className="root-vault rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--vault-panel)', border: '1px solid var(--vault-hairline)' }}>
            {/* Header — doubles as the expand/collapse trigger when onToggleCollapsed is passed */}
            <div
                className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3"
                style={{ borderBottom: '1px solid var(--vault-hairline)', cursor: onToggleCollapsed ? 'pointer' : undefined }}
                onClick={onToggleCollapsed}
            >
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid var(--vault-brass-border)' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" style={{ color: 'var(--vault-brass)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <h3 className="font-display text-base font-bold flex items-center gap-2" style={{ color: 'var(--vault-paper)' }}>
                        กระแสเงินสดรายวัน
                        {isToday && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: 'var(--vault-brass)', color: 'var(--vault-brass-ink)' }}>วันนี้</span>
                        )}
                        <span className="text-xs font-normal hidden sm:inline" style={{ color: 'var(--vault-muted)' }}>
                            · {isRoot ? 'Root แก้ไข/ลบได้' : 'ล็อกทันที แก้ไขได้เฉพาะ Root'}
                        </span>
                    </h3>
                </div>

                <div className="flex items-center gap-2">
                    {date === undefined && (
                        <input
                            type="date"
                            value={selectedDate}
                            max={toISODate(new Date())}
                            onChange={(e) => setInternalDate(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="px-3 py-1.5 rounded-lg text-sm font-figure font-medium focus:outline-none focus:ring-2"
                            style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid var(--vault-hairline)', color: 'var(--vault-paper)' }}
                        />
                    )}
                    {onToggleCollapsed && (
                        <svg
                            className={`w-5 h-5 shrink-0 transition-transform ${collapsed ? '' : 'rotate-180'}`}
                            style={{ color: 'var(--vault-brass)' }}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    )}
                </div>
            </div>

            {/* Body */}
            {!collapsed && (
            <div className="p-2.5 sm:p-3 space-y-2.5">
                {loading ? (
                    <div className="text-sm py-6 text-center" style={{ color: 'var(--vault-muted)' }}>กำลังโหลด...</div>
                ) : branches.length === 0 ? (
                    <div className="text-sm py-6 text-center" style={{ color: 'var(--vault-muted)' }}>ไม่มีข้อมูลร้านในช่วงที่ดึงมา</div>
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
            )}
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
        if (!window.confirm(`ลบรายการ ${l.Kind === 'opening' ? 'เงินเปิด' : 'เงินปิด'} ฿ ${formatTHB(Number(l.Amount))} ?`)) return
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
                        className="w-28 px-2 py-1.5 rounded-lg text-right text-sm font-figure font-semibold focus:outline-none focus:ring-2"
                        style={{ backgroundColor: 'var(--vault-bg)', border: '1px solid var(--vault-hairline)', color: 'var(--vault-paper)' }}
                    />
                    <button onClick={() => saveEdit(l)} className="px-2.5 py-1.5 rounded-lg text-sm font-bold" style={{ backgroundColor: 'var(--vault-brass)', color: 'var(--vault-brass-ink)' }}>✓</button>
                    <button onClick={() => setEditingId(null)} className="px-2.5 py-1.5 rounded-lg text-sm" style={{ backgroundColor: 'var(--vault-panel-raised)', color: 'var(--vault-muted)' }}>✕</button>
                </div>
            )
        }
        return (
            <span className="inline-flex items-center gap-2 whitespace-nowrap shrink-0">
                <span className="font-figure text-base sm:text-lg font-bold" style={{ color: 'var(--vault-paper)' }}>฿ {formatTHB(Number(l.Amount))}</span>
                <span className="text-xs" style={{ color: 'var(--vault-muted)' }}>{formatTime(l.created_at)}</span>
                {isRoot ? (
                    <span className="inline-flex items-center gap-1">
                        <button onClick={() => startEdit(l)} title="แก้ไข" className="p-1 rounded hover:opacity-100 opacity-70" style={{ color: 'var(--vault-brass)' }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => removeEntry(l)} title="ลบ" className="p-1 rounded hover:opacity-100 opacity-70" style={{ color: 'var(--vault-ink-debit)' }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </span>
                ) : (
                    <span title="ล็อกแล้ว — แก้ไขได้เฉพาะ Root" style={{ color: 'var(--vault-hairline)' }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </span>
                )}
            </span>
        )
    }

    const totalRounds = rounds.length + (showFirstOpening || showAddedOpening ? 1 : 0)

    return (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--vault-hairline)' }}>
            {/* Branch header with day flow */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5" style={{ backgroundColor: 'var(--vault-panel-raised)', borderBottom: '1px solid var(--vault-hairline)' }}>
                <span className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--vault-paper)' }}>
                    <span className="w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center font-figure" style={{ backgroundColor: 'var(--vault-bg)', color: 'var(--vault-brass)' }}>{branch}</span>
                    ร้าน {branch}
                </span>
                <span className="text-xs sm:text-sm flex flex-wrap items-center gap-x-3 gap-y-1 font-figure">
                    <span style={{ color: 'var(--vault-ink-credit)' }}>รับ +฿ {formatTHB(flow.thbIn)}</span>
                    <span style={{ color: 'var(--vault-ink-debit)' }}>จ่าย −฿ {formatTHB(flow.thbOut)}</span>
                    <span className="font-bold" style={{ color: dayNet >= 0 ? 'var(--vault-ink-credit)' : 'var(--vault-ink-debit)' }}>
                        สุทธิ {dayNet >= 0 ? '+' : '−'}฿ {formatTHB(Math.abs(dayNet))}
                    </span>
                </span>
            </div>

            <div className="p-2 space-y-2">
                {/* Persisted rounds */}
                {rounds.map((r, i) => {
                    const isAwaiting = i === awaitingIndex
                    const diff = r.closing ? Number(r.closing.Amount || 0) - Number(r.closing.System_Snapshot ?? 0) : null
                    return (
                        <RoundCard
                            key={r.opening.id}
                            index={i + 1}
                            left={withIcon('☀️', 'เงินเปิด', <LockedEntry l={r.opening} />)}
                            right={
                                r.closing ? (
                                    <span className="inline-flex items-center gap-2 flex-wrap">
                                        {withIcon('🌙', 'เงินปิด', <LockedEntry l={r.closing} />)}
                                        {diff !== null && (
                                            <SystemFigureChip amount={Number(r.closing.System_Snapshot ?? 0)} diff={diff} />
                                        )}
                                    </span>
                                ) : isAwaiting ? (
                                    withIcon('🌙', 'เงินปิด', (
                                        <ClosingInput
                                            value={closeAmt}
                                            onChange={setCloseAmt}
                                            onSave={saveClosing}
                                            saving={saving}
                                            expected={expectedClosing}
                                            previewDiff={closePreviewDiff}
                                        />
                                    ))
                                ) : (
                                    withIcon('🌙', 'เงินปิด', <span className="text-xs" style={{ color: 'var(--vault-hairline)' }}>—</span>)
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
                        left={withIcon('☀️', 'เงินเปิด', <OpeningInput value={openAmt} onChange={setOpenAmt} onSave={saveOpening} saving={saving} />)}
                        right={withIcon('🌙', 'เงินปิด', <span className="text-xs" style={{ color: 'var(--vault-hairline)' }}>บันทึกเงินเปิดก่อน</span>)}
                        complete={false}
                    />
                )}

                {/* Add-new-round button (only when the latest round is complete) */}
                {showAddButton && (
                    <button
                        onClick={() => setShowNew(true)}
                        className="w-full py-2.5 rounded-lg border-2 border-dashed text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                        style={{ borderColor: 'var(--vault-hairline)', color: 'var(--vault-muted)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--vault-brass)'; e.currentTarget.style.color = 'var(--vault-brass)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--vault-hairline)'; e.currentTarget.style.color = 'var(--vault-muted)' }}
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

// One round = opening (left) paired with closing (right).
// Desktop: a single compact row. Mobile: opening/closing stack as their own
// lines (a horizontal squeeze here reads as scrambled text, not compact).
function RoundCard({ index, left, right, complete }: { index: number; left: ReactNode; right: ReactNode; complete: boolean }) {
    const badge = complete
        ? <span className="text-xs px-2 py-1 rounded-full font-bold shrink-0" style={{ backgroundColor: 'rgba(79,174,129,0.15)', color: 'var(--vault-ink-credit)' }}>ครบแล้ว</span>
        : <span className="text-xs px-2 py-1 rounded-full font-bold shrink-0" style={{ backgroundColor: 'var(--vault-brass-tint)', color: 'var(--vault-brass)' }}>รอบันทึก</span>

    return (
        <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--vault-hairline)', backgroundColor: complete ? 'var(--vault-panel)' : 'var(--vault-brass-faint)' }}
        >
            {/* Mobile-only mini header: round # + status (hidden from sm: up, folded into the row instead) */}
            <div className="flex sm:hidden items-center justify-between px-3 py-1.5" style={{ borderBottom: '1px solid var(--vault-hairline)' }}>
                <span className="text-xs font-bold" style={{ color: 'var(--vault-muted)' }}>รอบที่ {index}</span>
                {badge}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 py-2.5 sm:py-3">
                <span className="hidden sm:inline-block text-xs font-bold shrink-0 w-4 text-center" style={{ color: 'var(--vault-muted)' }}>{index}</span>

                {left}

                <span className="hidden sm:inline shrink-0 text-sm" style={{ color: 'var(--vault-hairline)' }}>›</span>

                <span className="min-w-0 sm:flex-1">{right}</span>

                <span className="hidden sm:inline-flex">{badge}</span>
            </div>
        </div>
    )
}

// Prominent "system-calculated" figure — shown both as a live preview while
// entering a closing count, and pinned next to a saved closing entry.
function SystemFigureChip({ amount, diff }: { amount: number; diff: number | null }) {
    return (
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg flex-wrap" style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid var(--vault-hairline)' }}>
            <span className="text-[11px] font-bold uppercase tracking-wide shrink-0" style={{ color: 'var(--vault-muted)' }}>ระบบคิด</span>
            <span className="font-figure text-base sm:text-lg font-extrabold" style={{ color: 'var(--vault-paper)' }}>฿ {formatTHB(amount)}</span>
            {diff !== null && diff !== 0 && (
                <span className="font-figure text-sm sm:text-base font-extrabold" style={{ color: diff > 0 ? 'var(--vault-branch-blue)' : 'var(--vault-ink-debit)' }}>
                    {diff > 0 ? 'เกิน +' : 'ขาด −'}฿ {formatTHB(Math.abs(diff))}
                </span>
            )}
            {diff === 0 && <span className="text-sm sm:text-base font-extrabold" style={{ color: 'var(--vault-ink-credit)' }}>ตรง ✓</span>}
        </span>
    )
}

function OpeningInput({ value, onChange, onSave, saving }: { value: string; onChange: (v: string) => void; onSave: () => void; saving: boolean }) {
    return (
        <div className="flex items-center gap-2">
            <input
                type="number" inputMode="decimal" value={value} placeholder="จำนวนเงินเปิด"
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !saving) onSave() }}
                className="w-32 sm:w-36 min-w-0 px-3 py-2 rounded-lg text-right text-base font-figure font-semibold focus:outline-none focus:ring-2"
                style={{ backgroundColor: 'var(--vault-bg)', border: '1px solid var(--vault-hairline)', color: 'var(--vault-paper)' }}
            />
            <button onClick={onSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 whitespace-nowrap" style={{ backgroundColor: 'var(--vault-branch-blue)', color: 'var(--vault-blue-ink)' }}>
                บันทึกเปิด
            </button>
        </div>
    )
}

function ClosingInput({ value, onChange, onSave, saving, expected, previewDiff }: {
    value: string; onChange: (v: string) => void; onSave: () => void; saving: boolean; expected: number; previewDiff: number | null
}) {
    return (
        <span className="inline-flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-2 shrink-0">
                <input
                    type="number" inputMode="decimal" value={value} placeholder="นับเงินจริง"
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !saving) onSave() }}
                    className="w-28 sm:w-32 min-w-0 px-3 py-2 rounded-lg text-right text-base font-figure font-semibold focus:outline-none focus:ring-2"
                    style={{ backgroundColor: 'var(--vault-bg)', border: '1px solid var(--vault-hairline)', color: 'var(--vault-paper)' }}
                />
                <button onClick={onSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 whitespace-nowrap" style={{ backgroundColor: 'var(--vault-brass)', color: 'var(--vault-brass-ink)' }}>
                    บันทึกปิด
                </button>
            </span>
            <SystemFigureChip amount={expected} diff={previewDiff} />
        </span>
    )
}
