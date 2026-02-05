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

    return (
        <div className="bg-white/50 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-100/50 p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Client Traffic Analytics (09:00 - 21:00)
            </h3>

            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        margin={{
                            top: 5,
                            right: 30,
                            left: 20,
                            bottom: 5,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis
                            dataKey="time"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            allowDecimals={false}
                        />
                        <Tooltip
                            cursor={{ fill: '#F3F4F6' }}
                            contentStyle={{
                                borderRadius: '12px',
                                border: 'none',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                            }}
                        />
                        <Bar
                            dataKey="clients"
                            radius={[6, 6, 0, 0]}
                            barSize={32}
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.clients > 0 ? `rgba(37, 99, 235, ${0.4 + (entry.clients / maxClients) * 0.6})` : '#E5E7EB'}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
