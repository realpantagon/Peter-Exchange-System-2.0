import type { Rate } from '../../utils/currencyUtils'
import { getFlagIcon } from '../../utils/currencyUtils'

interface CurrencyCardProps {
  rate: Rate
  isSelected: boolean
  onClick: (rate: Rate) => void
}

export default function CurrencyCard({ rate, isSelected, onClick }: CurrencyCardProps) {
  return (
    <div
      onClick={() => onClick(rate)}
      className={`bg-white rounded shadow-sm p-2 cursor-pointer border transition-all hover:shadow ${isSelected
        ? 'border-blue-500 bg-blue-50 shadow ring-1 ring-blue-200'
        : 'border-gray-200 hover:border-blue-300'
        }`}
    >
      <div className="flex items-center gap-3">
        <img
          src={getFlagIcon(rate.Cur || '')}
          alt={`${rate.Cur || ''} flag`}
          className="w-6 h-6 rounded-full border border-gray-100 object-cover flex-shrink-0"
          onError={(e) => {
            e.currentTarget.src = '/vite.svg'
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base text-gray-800 truncate">{rate.Cur}</div>
        </div>
        <div className="text-base font-bold text-green-600 bg-green-50 px-3  rounded flex-shrink-0">
          {rate.Rate}
        </div>
      </div>
    </div>
  )
}