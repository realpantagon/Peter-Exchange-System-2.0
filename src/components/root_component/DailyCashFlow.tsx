import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    getBalanceLogs,
    createBalanceLog,
    updateBalanceLog,
    deleteBalanceLog,
} from '../../lib/api'
import type { PeterExchangeBalanceLog, BalanceLogKind } from '../../types/database'
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
            <div className="p-4 sm:p-6 space-y-4">
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
    const [kind, setKind] = useState<BalanceLogKind>('opening')
    const [amount, setAmount] = useState('')
    const [saving, setSaving] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editValue, setEditValue] = useState('')

    // Total opening cash = sum of all opening entries (initial + top-ups)
    const openingTotal = useMemo(
        () => logs.filter(l => l.Kind === 'opening').reduce((s, l) => s + Number(l.Amount || 0), 0),
        [logs]
    )
    const systemClosing = openingTotal + flow.thbIn - flow.thbOut

    const closings = useMemo(() => logs.filter(l => l.Kind === 'closing'), [logs])
    const latestClosing = closings.length ? closings[closings.length - 1] : null
    const latestDiff = latestClosing
        ? Number(latestClosing.Amount || 0) - Number(latestClosing.System_Snapshot ?? systemClosing)
        : null

    const parsedAmount = parseFloat(amount)
    const previewDiff = kind === 'closing' && !isNaN(parsedAmount) ? parsedAmount - systemClosing : null

    const handleAdd = async () => {
        if (isNaN(parsedAmount)) {
            notify?.('กรุณากรอกจำนวนเงิน', 'error')
            return
        }
        setSaving(true)
        try {
            await createBalanceLog({
                Date: date,
                Branch: branch,
                Kind: kind,
                Amount: parsedAmount,
                System_Snapshot: kind === 'closing' ? systemClosing : null,
            })
            setAmount('')
            notify?.(kind === 'opening' ? 'บันทึกเงินตั้งต้นแล้ว (ล็อก)' : 'บันทึกเงินปลายวันแล้ว (ล็อก)', 'success')
            onChanged()
        } catch {
            notify?.('บันทึกไม่สำเร็จ — ตรวจสอบตาราง Peter_Exchange_Balance_Log ใน Supabase', 'error')
        } finally {
            setSaving(false)
        }
    }

    const startEdit = (l: PeterExchangeBalanceLog) => {
        setEditingId(l.id)
        setEditValue(String(l.Amount))
    }

    const saveEdit = async (l: PeterExchangeBalanceLog) => {
        const v = parseFloat(editValue)
        if (isNaN(v)) { notify?.('จำนวนเงินไม่ถูกต้อง', 'error'); return }
        try {
            await updateBalanceLog(l.id, { Amount: v })
            setEditingId(null)
            notify?.('แก้ไขรายการเรียบร้อย', 'success')
            onChanged()
        } catch {
            notify?.('แก้ไขไม่สำเร็จ', 'error')
        }
    }

    const handleDelete = async (l: PeterExchangeBalanceLog) => {
        if (!window.confirm(`ลบรายการ ${l.Kind === 'opening' ? 'เงินตั้งต้น' : 'เงินปลายวัน'} ฿${formatTHB(Number(l.Amount))} ?`)) return
        try {
            await deleteBalanceLog(l.id)
            notify?.('ลบรายการเรียบร้อย', 'success')
            onChanged()
        } catch {
            notify?.('ลบไม่สำเร็จ', 'error')
        }
    }

    return (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
            {/* Branch title */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <span className="font-bold text-gray-800 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">{branch}</span>
                    ร้าน {branch}
                </span>
                <span className="text-[11px] text-gray-400">{logs.length} รายการวันนี้</span>
            </div>

            {/* Stat tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-gray-100">
                <Stat label="เงินตั้งต้นรวม" value={`฿${formatTHB(openingTotal)}`} tone="neutral" />
                <Stat label="เงินสดรับ (ขาย)" value={`+฿${formatTHB(flow.thbIn)}`} tone="green" />
                <Stat label="เงินสดจ่าย (ซื้อ)" value={`−฿${formatTHB(flow.thbOut)}`} tone="red" />
                <Stat label="ปลายวัน (ระบบคิด)" value={`฿${formatTHB(systemClosing)}`} tone="amber" />
                <Stat label="ปลายวันจริง (ล่าสุด)" value={latestClosing ? `฿${formatTHB(Number(latestClosing.Amount))}` : '—'} tone="neutral" />
                <Stat
                    label="ส่วนต่าง"
                    value={
                        latestDiff === null ? '—'
                            : latestDiff === 0 ? '✓ ตรง'
                                : `${latestDiff > 0 ? '+' : '−'}฿${formatTHB(Math.abs(latestDiff))}`
                    }
                    tone={latestDiff === null ? 'neutral' : latestDiff === 0 ? 'green' : latestDiff > 0 ? 'blue' : 'red'}
                />
            </div>

            {/* Timeline of entries */}
            <div className="divide-y divide-gray-100">
                {logs.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-gray-400 text-center">ยังไม่มีการบันทึกสำหรับวันนี้</div>
                ) : (
                    logs.map(l => {
                        const isOpening = l.Kind === 'opening'
                        const diff = l.Kind === 'closing'
                            ? Number(l.Amount || 0) - Number(l.System_Snapshot ?? 0)
                            : null
                        return (
                            <div key={l.id} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50">
                                <span className="text-[11px] tabular-nums text-gray-400 w-11 shrink-0">{formatTime(l.created_at)}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${isOpening ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {isOpening ? '☀️ เปิด' : '🌙 ปิด'}
                                </span>

                                {editingId === l.id ? (
                                    <div className="flex items-center gap-2 flex-1">
                                        <input
                                            type="number"
                                            value={editValue}
                                            autoFocus
                                            onChange={(e) => setEditValue(e.target.value)}
                                            className="w-32 px-2 py-1 rounded-lg border border-gray-300 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                        <button onClick={() => saveEdit(l)} className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700">บันทึก</button>
                                        <button onClick={() => setEditingId(null)} className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs hover:bg-gray-200">ยกเลิก</button>
                                    </div>
                                ) : (
                                    <>
                                        <span className="font-semibold text-gray-800 tabular-nums">฿{formatTHB(Number(l.Amount))}</span>
                                        {diff !== null && (
                                            <span className={`text-[11px] font-medium ${diff === 0 ? 'text-green-600' : diff > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                                {diff === 0 ? '(ตรงระบบ)' : `(${diff > 0 ? '+' : '−'}฿${formatTHB(Math.abs(diff))} vs ฿${formatTHB(Number(l.System_Snapshot ?? 0))})`}
                                            </span>
                                        )}
                                        <div className="ml-auto flex items-center gap-1.5 shrink-0">
                                            {isRoot ? (
                                                <>
                                                    <button onClick={() => startEdit(l)} title="แก้ไข" className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                    </button>
                                                    <button onClick={() => handleDelete(l)} title="ลบ" className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </>
                                            ) : (
                                                <span title="ล็อกแล้ว — แก้ไขได้เฉพาะ Root" className="text-gray-300">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                </span>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )
                    })
                )}
            </div>

            {/* Add entry form */}
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-gray-50 border-t border-gray-200">
                <div className="inline-flex rounded-lg bg-white border border-gray-200 p-0.5">
                    <button
                        onClick={() => setKind('opening')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${kind === 'opening' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                        ☀️ เปิด
                    </button>
                    <button
                        onClick={() => setKind('closing')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${kind === 'closing' ? 'bg-amber-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                        🌙 ปิด
                    </button>
                </div>

                <div className="relative flex-1 min-w-[140px]">
                    <input
                        type="number"
                        inputMode="decimal"
                        value={amount}
                        placeholder={kind === 'closing' ? `นับเงินจริง (ระบบคิด ฿${formatTHB(systemClosing)})` : 'จำนวนเงินตั้งต้น'}
                        onChange={(e) => setAmount(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !saving) handleAdd() }}
                        className="w-full pl-3 pr-3 py-2 rounded-lg border border-gray-200 text-right focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    {previewDiff !== null && (
                        <span className={`absolute -bottom-4 right-1 text-[10px] font-medium ${previewDiff === 0 ? 'text-green-600' : previewDiff > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {previewDiff === 0 ? 'ตรงระบบ' : `${previewDiff > 0 ? 'เกิน' : 'ขาด'} ฿${formatTHB(Math.abs(previewDiff))}`}
                        </span>
                    )}
                </div>

                <button
                    onClick={handleAdd}
                    disabled={saving}
                    className={`px-4 py-2 rounded-lg text-white text-sm font-semibold transition-colors disabled:opacity-50 ${kind === 'opening' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                >
                    {saving ? 'กำลังบันทึก...' : '➕ บันทึก (ล็อก)'}
                </button>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------

const TONE: { [k: string]: string } = {
    neutral: 'text-gray-900',
    green: 'text-green-600',
    red: 'text-red-600',
    amber: 'text-amber-600',
    blue: 'text-blue-600',
}

function Stat({ label, value, tone }: { label: string; value: string; tone: keyof typeof TONE }) {
    return (
        <div className="bg-white px-3 py-2.5">
            <div className="text-[10px] text-gray-400 mb-0.5 leading-tight">{label}</div>
            <div className={`text-sm font-bold tabular-nums ${TONE[tone]}`}>{value}</div>
        </div>
    )
}
