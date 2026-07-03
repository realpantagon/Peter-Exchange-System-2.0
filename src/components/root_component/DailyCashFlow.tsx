import { useEffect, useMemo, useState } from 'react'
import { getDailyBalances, upsertDailyBalance } from '../../lib/api'
import type { Transaction } from '../../utils/currencyUtils'

interface DailyCashFlowProps {
    transactions: Transaction[]
    notify?: (message: string, type: 'success' | 'error' | 'info') => void
    // When set, scope the whole card to a single branch (e.g. staff on /system2025).
    branchId?: string | null
    // When set, the date is controlled by the parent and the internal picker is hidden.
    date?: string
}

const formatTHB = (value: number) =>
    new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(value)

// Local 'YYYY-MM-DD' for a date
const toISODate = (d: Date) => d.toLocaleDateString('en-CA') // en-CA => YYYY-MM-DD

export default function DailyCashFlow({ transactions, notify, branchId, date }: DailyCashFlowProps) {
    const [internalDate, setInternalDate] = useState<string>(toISODate(new Date()))
    const selectedDate = date ?? internalDate
    const [openingBalances, setOpeningBalances] = useState<{ [branch: string]: string }>({})
    const [filledClosings, setFilledClosings] = useState<{ [branch: string]: string }>({})
    const [savingOpening, setSavingOpening] = useState(false)
    const [savingClosing, setSavingClosing] = useState(false)

    const branches = useMemo(() => {
        if (branchId) return [branchId]
        return Array.from(new Set(transactions.map(t => t.Branch).filter(Boolean))) as string[]
    }, [transactions, branchId])

    // Per-branch cash movement for the selected date
    const flows = useMemo(() => {
        const map: { [branch: string]: { thbIn: number; thbOut: number } } = {}
        branches.forEach(b => (map[b] = { thbIn: 0, thbOut: 0 }))

        transactions.forEach(t => {
            if (!t.created_at || !t.Branch) return
            if (branchId && t.Branch !== branchId) return
            if (toISODate(new Date(t.created_at)) !== selectedDate) return
            if (!map[t.Branch]) map[t.Branch] = { thbIn: 0, thbOut: 0 }

            const total = Math.abs(parseFloat(t.Total_TH || '0') || 0)
            if (t.Transaction_Type === 'Selling') {
                // Shop receives THB from customer
                map[t.Branch].thbIn += total
            } else {
                // Buying (or anything else): shop pays THB out
                map[t.Branch].thbOut += total
            }
        })

        return map
    }, [transactions, branches, selectedDate, branchId])

    // Load saved balances for the selected date (graceful: [] until table exists)
    useEffect(() => {
        let cancelled = false
        const load = async () => {
            const rows = await getDailyBalances(selectedDate, branchId || undefined)
            if (cancelled) return
            const nextOpening: { [branch: string]: string } = {}
            const nextFilled: { [branch: string]: string } = {}
            rows.forEach(r => {
                nextOpening[r.Branch] = String(r.Opening_Balance ?? 0)
                if (r.closing_balance_filled !== null && r.closing_balance_filled !== undefined) {
                    nextFilled[r.Branch] = String(r.closing_balance_filled)
                }
            })
            setOpeningBalances(nextOpening)
            setFilledClosings(nextFilled)
        }
        load()
        return () => { cancelled = true }
    }, [selectedDate, branchId])

    const openingOf = (b: string) => parseFloat(openingBalances[b] || '0') || 0
    // System-computed end-of-day cash
    const systemClosingOf = (b: string) =>
        openingOf(b) + (flows[b]?.thbIn || 0) - (flows[b]?.thbOut || 0)
    // Whether staff has entered an actual count
    const hasFilled = (b: string) => {
        const v = filledClosings[b]
        return v !== undefined && v !== ''
    }
    const filledOf = (b: string) => parseFloat(filledClosings[b] || '0') || 0
    // Over (+) / short (-) vs. what the system expects
    const diffOf = (b: string) => filledOf(b) - systemClosingOf(b)

    const totals = useMemo(() => {
        let opening = 0, thbIn = 0, thbOut = 0
        branches.forEach(b => {
            opening += openingOf(b)
            thbIn += flows[b]?.thbIn || 0
            thbOut += flows[b]?.thbOut || 0
        })
        return { opening, thbIn, thbOut, net: thbIn - thbOut, closing: opening + thbIn - thbOut }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branches, flows, openingBalances])

    // Morning: save only the opening balances (won't touch the closing figures)
    const handleSaveOpening = async () => {
        setSavingOpening(true)
        try {
            await Promise.all(
                branches.map(b =>
                    upsertDailyBalance({
                        Date: selectedDate,
                        Branch: b,
                        Opening_Balance: openingOf(b),
                    })
                )
            )
            notify?.('บันทึกเงินตั้งต้นเรียบร้อย', 'success')
        } catch {
            notify?.('ยังบันทึกไม่ได้ — ตาราง Peter_Exchange_Daily_Balance ยังไม่ถูกสร้างใน Supabase', 'error')
        } finally {
            setSavingOpening(false)
        }
    }

    // End of day: save the system-computed closing + the staff-counted closing
    const handleSaveClosing = async () => {
        setSavingClosing(true)
        try {
            await Promise.all(
                branches.map(b =>
                    upsertDailyBalance({
                        Date: selectedDate,
                        Branch: b,
                        actual_closing_balance_system: systemClosingOf(b),
                        closing_balance_filled: hasFilled(b) ? filledOf(b) : null,
                    })
                )
            )
            notify?.('บันทึกเงินปลายวันเรียบร้อย', 'success')
        } catch {
            notify?.('ยังบันทึกไม่ได้ — ตาราง Peter_Exchange_Daily_Balance ยังไม่ถูกสร้างใน Supabase', 'error')
        } finally {
            setSavingClosing(false)
        }
    }

    const isToday = selectedDate === toISODate(new Date())

    return (
        <div className="bg-white/50 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-100/50 p-6 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    กระแสเงินสดรายวัน (Cash Flow)
                    {isToday && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">วันนี้</span>}
                </h3>

                <div className="flex flex-wrap items-center gap-2">
                    {date === undefined && (
                        <input
                            type="date"
                            value={selectedDate}
                            max={toISODate(new Date())}
                            onChange={(e) => setInternalDate(e.target.value)}
                            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                    )}
                    <button
                        onClick={handleSaveOpening}
                        disabled={savingOpening || branches.length === 0}
                        className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        {savingOpening ? 'กำลังบันทึก...' : '☀️ บันทึกเงินตั้งต้น'}
                    </button>
                    <button
                        onClick={handleSaveClosing}
                        disabled={savingClosing || branches.length === 0}
                        className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
                    >
                        {savingClosing ? 'กำลังบันทึก...' : '🌙 บันทึกเงินปลายวัน'}
                    </button>
                </div>
            </div>

            {branches.length === 0 ? (
                <div className="text-sm text-gray-400 py-6 text-center">ไม่มีข้อมูลร้านในช่วงที่ดึงมา</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-500 border-b border-gray-200">
                                <th className="py-2 pr-4 font-semibold">ร้าน</th>
                                <th className="py-2 px-4 font-semibold text-right">เงินตั้งต้น (฿)</th>
                                <th className="py-2 px-4 font-semibold text-right text-green-600">เงินสดรับ (ขาย)</th>
                                <th className="py-2 px-4 font-semibold text-right text-red-600">เงินสดจ่าย (ซื้อ)</th>
                                <th className="py-2 px-4 font-semibold text-right">ปลายวัน (ระบบคิด)</th>
                                <th className="py-2 px-4 font-semibold text-right">ปลายวันจริง (นับเงิน)</th>
                                <th className="py-2 pl-4 font-semibold text-right">ส่วนต่าง</th>
                            </tr>
                        </thead>
                        <tbody>
                            {branches.map(b => {
                                const f = flows[b] || { thbIn: 0, thbOut: 0 }
                                const sysClosing = systemClosingOf(b)
                                const filled = hasFilled(b)
                                const diff = diffOf(b)
                                return (
                                    <tr key={b} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="py-2 pr-4 font-medium text-gray-700">ร้าน {b}</td>
                                        <td className="py-2 px-4 text-right">
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                value={openingBalances[b] ?? ''}
                                                placeholder="0"
                                                onChange={(e) => setOpeningBalances(prev => ({ ...prev, [b]: e.target.value }))}
                                                className="w-28 px-3 py-1.5 rounded-lg border border-gray-200 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </td>
                                        <td className="py-2 px-4 text-right text-green-600">+฿{formatTHB(f.thbIn)}</td>
                                        <td className="py-2 px-4 text-right text-red-600">−฿{formatTHB(f.thbOut)}</td>
                                        <td className="py-2 px-4 text-right font-bold text-gray-900">฿{formatTHB(sysClosing)}</td>
                                        <td className="py-2 px-4 text-right">
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                value={filledClosings[b] ?? ''}
                                                placeholder="นับเงินจริง"
                                                onChange={(e) => setFilledClosings(prev => ({ ...prev, [b]: e.target.value }))}
                                                className="w-32 px-3 py-1.5 rounded-lg border border-gray-200 text-right focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            />
                                        </td>
                                        <td className="py-2 pl-4 text-right font-bold">
                                            {!filled ? (
                                                <span className="text-gray-300">—</span>
                                            ) : diff === 0 ? (
                                                <span className="text-green-600">✓ ตรง</span>
                                            ) : (
                                                <span className={diff > 0 ? 'text-blue-600' : 'text-red-600'}>
                                                    {diff > 0 ? '+' : '−'}฿{formatTHB(Math.abs(diff))}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-gray-200 font-bold text-gray-900">
                                <td className="py-2 pr-4">รวมทุกร้าน</td>
                                <td className="py-2 px-4 text-right">฿{formatTHB(totals.opening)}</td>
                                <td className="py-2 px-4 text-right text-green-700">+฿{formatTHB(totals.thbIn)}</td>
                                <td className="py-2 px-4 text-right text-red-700">−฿{formatTHB(totals.thbOut)}</td>
                                <td className="py-2 px-4 text-right text-amber-700">฿{formatTHB(totals.closing)}</td>
                                <td className="py-2 px-4 text-right">
                                    ฿{formatTHB(branches.reduce((s, b) => s + (hasFilled(b) ? filledOf(b) : 0), 0))}
                                </td>
                                <td className="py-2 pl-4 text-right">
                                    {(() => {
                                        const totalDiff = branches.reduce((s, b) => s + (hasFilled(b) ? diffOf(b) : 0), 0)
                                        if (totalDiff === 0) return <span className="text-green-600">✓</span>
                                        return (
                                            <span className={totalDiff > 0 ? 'text-blue-600' : 'text-red-600'}>
                                                {totalDiff > 0 ? '+' : '−'}฿{formatTHB(Math.abs(totalDiff))}
                                            </span>
                                        )
                                    })()}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            <p className="mt-4 text-[11px] text-gray-400">
                <b>เงินตั้งต้น</b> พนักงานกรอกทุกเช้า แล้วกด "บันทึกเงินตั้งต้น".
                <b> ปลายวัน (ระบบคิด)</b> = เงินตั้งต้น + เงินสดรับ − เงินสดจ่าย.
                หลังปิดวันพนักงานนับเงินจริงกรอกที่ช่อง <b>ปลายวันจริง</b> แล้วกด "บันทึกเงินปลายวัน" —
                ระบบจะแสดง <b>ส่วนต่าง</b> (+ เกิน / − ขาด) ให้ root เห็น.
                ใช้งานได้เมื่อสร้างตาราง <code>Peter_Exchange_Daily_Balance</code> ใน Supabase แล้ว (ดู supabase/migrations/).
            </p>
        </div>
    )
}
