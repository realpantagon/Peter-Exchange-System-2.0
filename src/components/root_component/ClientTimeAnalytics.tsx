import { useMemo } from 'react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts'
import type { Transaction } from '../../utils/currencyUtils'

interface ClientTimeAnalyticsProps {
    transactions: Transaction[]
}

const HOURS = [
    '09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
    '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'
]

export default function ClientTimeAnalytics({ transactions }: ClientTimeAnalyticsProps) {
    const data = useMemo(() => {
        // Initialize counts for each hour slot
        const hourCounts: { [key: string]: number } = {}
        HOURS.forEach(h => hourCounts[h] = 0)

        transactions.forEach(t => {
            if (!t.created_at) return

            const date = new Date(t.created_at)
            const hour = date.getHours()

            // Filter for 09:00 - 21:00 range
            if (hour >= 9 && hour <= 21) {
                // Determine the slot (e.g., 9:15 -> 09:00)
                // We map exact hours. All transactions in 9:xx count towards 9:00
                const hourString = `${hour.toString().padStart(2, '0')}:00`
                if (hourCounts[hourString] !== undefined) {
                    hourCounts[hourString]++
                }
            }
        })

        return HOURS.map(hour => ({
            time: hour,
            clients: hourCounts[hour]
        }))
    }, [transactions])

    // Find max value to scaling opacity or color if needed
    const maxClients = Math.max(...data.map(d => d.clients), 1)
    const busiestHour = data.reduce((best, d) => (d.clients > best.clients ? d : best), data[0])

    return (
        <div className="root-vault rounded-2xl p-5 sm:p-6" style={{ backgroundColor: 'var(--vault-panel)', border: '1px solid var(--vault-hairline)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                <h3 className="font-display text-base sm:text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--vault-paper)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" style={{ color: 'var(--vault-brass)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    ช่วงเวลาที่ลูกค้าเข้าใช้บริการ
                    <span className="text-xs font-normal" style={{ color: 'var(--vault-muted)' }}>· 09:00–21:00</span>
                </h3>
                {maxClients > 0 && (
                    <span className="font-figure text-xs" style={{ color: 'var(--vault-muted)' }}>
                        ช่วงพีค <span style={{ color: 'var(--vault-brass)' }} className="font-semibold">{busiestHour.time} น.</span> · {busiestHour.clients} รายการ
                    </span>
                )}
            </div>

            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        margin={{
                            top: 5,
                            right: 20,
                            left: 10,
                            bottom: 5,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--vault-hairline)" />
                        <XAxis
                            dataKey="time"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--vault-muted)', fontSize: 11 }}
                            dy={10}
                            interval="preserveStartEnd"
                            minTickGap={12}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--vault-muted)', fontSize: 12 }}
                            allowDecimals={false}
                        />
                        <Tooltip
                            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                            contentStyle={{
                                borderRadius: '12px',
                                border: '1px solid var(--vault-hairline)',
                                backgroundColor: 'var(--vault-panel)',
                                color: 'var(--vault-paper)'
                            }}
                            labelStyle={{ color: 'var(--vault-muted)' }}
                            formatter={(value) => [`${value} รายการ`, 'ลูกค้า']}
                        />
                        <Bar
                            dataKey="clients"
                            radius={[6, 6, 0, 0]}
                            barSize={32}
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.clients > 0 ? `rgba(37, 99, 235, ${0.35 + (entry.clients / maxClients) * 0.65})` : 'var(--vault-hairline)'}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
