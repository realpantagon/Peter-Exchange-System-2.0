import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTransactions } from '../lib/api'
import type { Transaction } from '../utils/currencyUtils'
import ClientTimeAnalytics from './root_component/ClientTimeAnalytics'
import DailyCashFlow from './root_component/DailyCashFlow'
import Toast from './system_component/Toast'

const BRANCH_COLORS: { [b: string]: string } = { '4': '#2563EB', '11': '#EAB308' }
const FALLBACK = ['#16A34A', '#EA580C', '#9333EA', '#DB2777', '#0891B2']

const toISODate = (d: Date) => d.toLocaleDateString('en-CA') // YYYY-MM-DD
const formatTHB = (v: number) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(v)
const formatTime = (s: string) =>
    new Date(s).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false })

export default function DailyDetailPage() {
    const [selectedDate, setSelectedDate] = useState<string>(toISODate(new Date()))
    const [branchFilter, setBranchFilter] = useState<string>('')
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

    useEffect(() => {
        const fetchDay = async () => {
            setLoading(true)
            try {
                const start = new Date(`${selectedDate}T00:00:00`).toISOString()
                const end = new Date(`${selectedDate}T23:59:59.999`).toISOString()
                const data = await getTransactions(start, undefined, end)
                setTransactions(data)
            } catch (e) {
                console.error('Error fetching day transactions:', e)
                setToast({ message: 'โหลดข้อมูลไม่สำเร็จ', type: 'error' })
            } finally {
                setLoading(false)
            }
        }
        fetchDay()
    }, [selectedDate])

    const branches = useMemo(
        () => Array.from(new Set(transactions.map(t => t.Branch).filter(Boolean))) as string[],
        [transactions]
    )
    const branchColor = (b: string) => BRANCH_COLORS[b] || FALLBACK[branches.indexOf(b) % FALLBACK.length]

    // Apply branch filter
    const dayTx = useMemo(
        () => transactions.filter(t => (branchFilter ? t.Branch === branchFilter : true)),
        [transactions, branchFilter]
    )

    // Chronological (morning -> night)
    const timeline = useMemo(
        () => [...dayTx].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
        [dayTx]
    )

    // Summary
    const summary = useMemo(() => {
        let received = 0, paid = 0
        dayTx.forEach(t => {
            const total = Math.abs(parseFloat(t.Total_TH || '0') || 0)
            if (t.Transaction_Type === 'Selling') received += total
            else paid += total
        })
        return { count: dayTx.length, received, paid, net: received - paid }
    }, [dayTx])

    // Per-branch quick stats
    const perBranch = useMemo(() => {
        const map: { [b: string]: { count: number; received: number; paid: number } } = {}
        const list = branchFilter ? [branchFilter] : branches
        list.forEach(b => (map[b] = { count: 0, received: 0, paid: 0 }))
        dayTx.forEach(t => {
            if (!t.Branch || !map[t.Branch]) return
            const total = Math.abs(parseFloat(t.Total_TH || '0') || 0)
            map[t.Branch].count++
            if (t.Transaction_Type === 'Selling') map[t.Branch].received += total
            else map[t.Branch].paid += total
        })
        return map
    }, [dayTx, branches, branchFilter])

    const isToday = selectedDate === toISODate(new Date())
    const dateLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('th-TH', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-wrap justify-between items-center gap-4 sticky top-0 z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <img src="/Ex_logo_6.png" alt="Logo" className="h-10 w-auto" />
                    <h1 className="text-xl font-bold text-gray-800">รายละเอียดรายวัน</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Link to="/root" className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        กลับ Root
                    </Link>
                </div>
            </div>

            <div className="flex-1 p-6 w-full mx-auto space-y-6">
                {/* Controls */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="text-sm text-gray-500">กำลังดูวันที่</div>
                        <div className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            {dateLabel}
                            {isToday && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">วันนี้</span>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={selectedDate}
                            max={toISODate(new Date())}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <select
                            value={branchFilter}
                            onChange={(e) => setBranchFilter(e.target.value)}
                            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">ทุกร้าน</option>
                            {branches.map(b => <option key={b} value={b}>ร้าน {b}</option>)}
                        </select>
                    </div>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                        <div className="text-xs font-semibold text-gray-500 mb-1">จำนวนรายการ</div>
                        <div className="text-2xl font-bold text-gray-800">{summary.count}</div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                        <div className="text-xs font-semibold text-green-600 mb-1">เงินสดรับ (ขาย)</div>
                        <div className="text-2xl font-bold text-green-700">฿{formatTHB(summary.received)}</div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                        <div className="text-xs font-semibold text-red-600 mb-1">เงินสดจ่าย (ซื้อ)</div>
                        <div className="text-2xl font-bold text-red-700">฿{formatTHB(summary.paid)}</div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                        <div className="text-xs font-semibold text-gray-500 mb-1">กระแสเงินสดสุทธิ</div>
                        <div className={`text-2xl font-bold ${summary.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {summary.net >= 0 ? '+' : '−'}฿{formatTHB(Math.abs(summary.net))}
                        </div>
                    </div>
                </div>

                {/* Per-branch chips */}
                {!branchFilter && branches.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {branches.map(b => {
                            const s = perBranch[b]
                            return (
                                <div key={b} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: branchColor(b) }} />
                                        <span className="font-bold text-gray-800">ร้าน {b}</span>
                                        <span className="text-xs text-gray-400">{s?.count || 0} รายการ</span>
                                    </div>
                                    <div className="text-sm">
                                        <span className="text-green-600">+฿{formatTHB(s?.received || 0)}</span>
                                        <span className="text-gray-300 mx-1">/</span>
                                        <span className="text-red-600">−฿{formatTHB(s?.paid || 0)}</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Hourly traffic graph */}
                <ClientTimeAnalytics transactions={dayTx} />

                {/* Cash flow (controlled by this page's date) */}
                <DailyCashFlow
                    transactions={transactions}
                    date={selectedDate}
                    branchId={branchFilter || undefined}
                    notify={(message, type) => setToast({ message, type })}
                    isRoot
                />

                {/* Detailed timeline */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800">ไทม์ไลน์รายการ ({timeline.length})</h3>
                        <p className="text-sm text-gray-500">เรียงตามเวลาที่เข้ามา (เช้า → ดึก)</p>
                    </div>
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="p-10 text-center text-gray-400">กำลังโหลด...</div>
                        ) : timeline.length === 0 ? (
                            <div className="p-10 text-center text-gray-400">ไม่มีรายการในวันนี้</div>
                        ) : (
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50/80 sticky top-0">
                                    <tr className="text-left text-gray-500">
                                        <th className="py-2.5 px-4 font-semibold">เวลา</th>
                                        <th className="py-2.5 px-4 font-semibold">ร้าน</th>
                                        <th className="py-2.5 px-4 font-semibold">ประเภท</th>
                                        <th className="py-2.5 px-4 font-semibold">สกุล</th>
                                        <th className="py-2.5 px-4 font-semibold text-right">จำนวน</th>
                                        <th className="py-2.5 px-4 font-semibold text-right">เรต</th>
                                        <th className="py-2.5 px-4 font-semibold text-right">รวม (฿)</th>
                                        <th className="py-2.5 px-4 font-semibold">ลูกค้า</th>
                                        <th className="py-2.5 px-4 font-semibold">สัญชาติ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {timeline.map(t => {
                                        const selling = t.Transaction_Type === 'Selling'
                                        return (
                                            <tr key={t.id} className="hover:bg-gray-50">
                                                <td className="py-2.5 px-4 font-mono font-semibold text-gray-800 whitespace-nowrap">{formatTime(t.created_at)}</td>
                                                <td className="py-2.5 px-4">
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: branchColor(t.Branch || '') }} />
                                                        {t.Branch || '-'}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-4">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${selling ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {selling ? 'ขาย' : 'ซื้อ'}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-4 font-medium text-gray-700">{t.Cur || t.Currency || '-'}</td>
                                                <td className="py-2.5 px-4 text-right text-gray-600">{t.Amount || '-'}</td>
                                                <td className="py-2.5 px-4 text-right text-gray-600">{t.Rate || '-'}</td>
                                                <td className="py-2.5 px-4 text-right font-semibold text-gray-900">฿{formatTHB(Math.abs(parseFloat(t.Total_TH || '0') || 0))}</td>
                                                <td className="py-2.5 px-4 text-gray-600 max-w-[160px] truncate" title={t.Customer_Name || ''}>{t.Customer_Name || '-'}</td>
                                                <td className="py-2.5 px-4 text-gray-600">{t.Customer_Nationality || '-'}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    )
}
