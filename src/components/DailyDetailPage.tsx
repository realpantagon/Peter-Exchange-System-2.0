import { useEffect, useMemo, useState } from 'react'
import { getTransactions } from '../lib/api'
import type { Transaction } from '../utils/currencyUtils'
import ClientTimeAnalytics from './root_component/ClientTimeAnalytics'
import Toast from './system_component/Toast'
import { LoadingBlock } from './Spinner'

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

    const isToday = selectedDate === toISODate(new Date())
    const dateLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('th-TH', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <div className="flex-1 p-4 sm:p-6 w-full mx-auto space-y-6">
                <h1 className="text-xl font-bold text-gray-800">รายละเอียดรายวัน</h1>

                {/* Controls */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                        <div className="text-sm text-gray-500">กำลังดูวันที่</div>
                        <div className="text-base sm:text-lg font-bold text-gray-800 flex flex-wrap items-center gap-2">
                            {dateLabel}
                            {isToday && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold shrink-0">วันนี้</span>}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        <input
                            type="date"
                            value={selectedDate}
                            max={toISODate(new Date())}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="flex-1 min-w-[150px] sm:flex-none px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <select
                            value={branchFilter}
                            onChange={(e) => setBranchFilter(e.target.value)}
                            className="flex-1 min-w-[110px] sm:flex-none px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">ทุกร้าน</option>
                            {branches.map(b => <option key={b} value={b}>ร้าน {b}</option>)}
                        </select>
                    </div>
                </div>

                {/* Hourly traffic graph */}
                <ClientTimeAnalytics transactions={dayTx} />

                {/* Detailed timeline */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800">ไทม์ไลน์รายการ ({timeline.length})</h3>
                        <p className="text-sm text-gray-500">เรียงตามเวลาที่เข้ามา (เช้า → ดึก)</p>
                    </div>
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="p-10 text-gray-400"><LoadingBlock label="กำลังโหลดรายการ…" /></div>
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
