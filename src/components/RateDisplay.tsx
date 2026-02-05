import { useEffect, useState } from "react"
// import { MOCK_RATES } from '../mocks/data'
import { getRates } from '../lib/api'
import type { PeterExchangeRate } from '../types/database'

export default function RateDisplay() {
    const [rates, setRates] = useState<PeterExchangeRate[]>([])
    const [now, setNow] = useState<string>("");
    const [theme, setTheme] = useState<'blue' | 'yellow' | 'orange'>('blue');

    const themeColors = {
        blue: 'bg-blue-200',
        yellow: 'bg-yellow-200',
        orange: 'bg-orange-200'
    };

    const fetchRates = async () => {
        try {
            const data = await getRates()
            setRates(data)
        } catch (error) {
            console.error("Failed to fetch rates", error)
        }
    }

    const cycleTheme = () => {
        const themes: ('blue' | 'yellow' | 'orange')[] = ['blue', 'yellow', 'orange'];
        const currentIndex = themes.indexOf(theme);
        const nextIndex = (currentIndex + 1) % themes.length;
        setTheme(themes[nextIndex]);
    };

    useEffect(() => {
        const updateTime = () => {
            const d = new Date();
            setNow(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
        };
        updateTime();
        const timer = setInterval(updateTime, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchRates()
    }, [])

    const getFlagIcon = (currencyCode: string) => {
        const flagMap: { [key: string]: string } = {
            AUD: "/AUD.png",
            CAD: "/CAD.png",
            CHF: "/CHF.png",
            CNY: "/CNY.png",
            EUR: "/EUR.png",
            GBP: "/GBP.png",
            HKD: "/HKD.png",
            JPY: "/JPY.png",
            KRW: "/KRW.png",
            MYR: "/MYR.png",
            NZD: "/NZD.png",
            SGD: "/SGD.png",
            TWD: "/TWD.png",
            USD: "/USA.png",
            USD2: "/USA.png",
            USD1: "/USA.png",
        }
        return flagMap[currencyCode] || "/vite.svg"
    }

    return (
        <div className="h-screen w-screen bg-gray-50 flex flex-col">
            <div className="bg-white border-b border-gray-200 px-2 sm:px-6 pt-1 sm:pt-2 flex-shrink-0 flex items-center justify-between">

                <button
                    onClick={fetchRates}
                    className="p-1 sm:p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
                    title="Refresh rates"
                >
                    <img
                        src="/Ex_logo_6.png"
                        alt="Peter Exchange Logo"
                        className="h-10 sm:h-14 md:h-20"
                    />
                </button>
                <div className="flex items-center gap-2 sm:gap-4">
                    <button
                        onClick={cycleTheme}
                        className="p-1 sm:p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
                        title={`Current theme: ${theme}. Click to change.`}
                    >
                        <svg
                            className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                        >
                            <path
                                fillRule="evenodd"
                                d="M4 2a2 2 0 00-2 2v11a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v11H4V4z"
                                clipRule="evenodd"
                            />
                            <path d="M6 6h8v2H6V6zm0 4h8v2H6v-2z" />
                        </svg>
                    </button>
                    <span className="text-base sm:text-lg md:text-2xl font-semibold text-emerald-600 flex items-center gap-1 sm:gap-2">
                        <span className="text-gray-500 font-mono text-xl sm:text-2xl md:text-3xl">
                            {now}
                        </span>
                    </span>
                </div>
            </div>


            <div className="flex-1 overflow-hidden p-2 sm:p-4 lg:p-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
                    <div className="flex flex-col h-full">
                        <table className="w-full flex-1">
                            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                                <tr>
                                    <th className="px-2 lg:px-8 text-left text-sm lg:text-lg font-semibold text-gray-700 uppercase tracking-wider">
                                        Currency
                                    </th>
                                    <th className="px-2 lg:px-8 text-left text-sm lg:text-lg font-semibold text-gray-700 uppercase tracking-wider">

                                    </th>
                                    <th className="px-2 lg:px-8 text-right text-sm lg:text-lg font-semibold text-gray-700 uppercase tracking-wider">
                                        Buying Rate
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {rates.map((rate, index) => (
                                    <tr key={rate.id} className={`hover:bg-blue-50 transition-colors duration-150 ${index % 2 === 1 ? themeColors[theme] : 'bg-white'
                                        }`}>
                                        <td className="px-2 lg:px-8 py-2 lg:py-2">
                                            <div className="flex items-center space-x-2 lg:space-x-4">
                                                <img
                                                    src={getFlagIcon(rate.Cur || '') || "/placeholder.svg"}
                                                    alt={`${rate.Cur || ''} flag`}
                                                    className="w-10 h-10 lg:w-20 lg:h-20 rounded-full object-cover border border-gray-200"
                                                    onError={(e) => {
                                                        e.currentTarget.src = "/vite.svg"
                                                    }}
                                                />
                                                <div className="text-lg lg:text-5xl font-semibold text-gray-900">
                                                    {/* {rate.Currency} */}
                                                    {rate.Cur}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-2 lg:px-8 py-2 lg:py-2">
                                            <span className="inline-flex items-center px-2 lg:px-3 py-1 rounded-md font-mono font-bold text-gray-800 bg-gray-100">
                                                {/* {rate.Cur} */}
                                                <div className="text-sm lg:text-2xl font-semibold text-gray-900">{rate.Currency}</div>
                                            </span>
                                        </td>
                                        <td className="px-2 lg:px-8 py-2 lg:py-2 text-right">
                                            <div className="text-xl lg:text-5xl font-bold text-gray-900 font-mono">
                                                {rate.Rate}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>




                </div>
            </div>
        </div>
    )
}