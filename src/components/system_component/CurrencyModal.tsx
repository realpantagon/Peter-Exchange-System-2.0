import TransactionForm from './TransactionForm'
import type { Rate } from '../../utils/currencyUtils'
import { getFlagIcon } from '../../utils/currencyUtils'

interface CurrencyModalProps {
  selectedRate: Rate | null
  onClose: () => void
  showTransactionForm: boolean
  onNewTransaction: () => void
  customRate: string
  setCustomRate: (rate: string) => void
  amount: string
  setAmount: (amount: string) => void
  transactionType: string
  setTransactionType: (type: string) => void
  passportNo: string
  setPassportNo: (value: string) => void
  nationality: string
  setNationality: (value: string) => void
  customerName: string
  setCustomerName: (value: string) => void
  calculateTotal: () => string
  onSaveTransaction: () => void
  onCancelTransaction: () => void
  isEditing: boolean
  isCustomCurrency?: boolean
  customCurrencyCode?: string
  setCustomCurrencyCode?: (code: string) => void
}

export default function CurrencyModal({
  selectedRate,
  onClose,
  showTransactionForm,
  onNewTransaction,
  customRate,
  setCustomRate,
  amount,
  setAmount,
  transactionType,
  setTransactionType,
  passportNo,
  setPassportNo,
  nationality,
  setNationality,
  customerName,
  setCustomerName,
  calculateTotal,
  onSaveTransaction,
  onCancelTransaction,
  isEditing,
  isCustomCurrency = false,
  customCurrencyCode = '',
  setCustomCurrencyCode
}: CurrencyModalProps) {
  if (!selectedRate && !isCustomCurrency) return null


  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lg p-4 w-full max-w-md mx-2 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-lg w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100"
        >
          ✕
        </button>

        {/* Header */}
        <div className="text-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">Currency</h3>
          <div className="w-10 h-0.5 bg-gradient-to-r from-blue-500 to-green-500 mx-auto"></div>
        </div>

        {/* Currency Info or Custom Header */}
        {!isCustomCurrency ? (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg p-4 mb-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={getFlagIcon(selectedRate?.Cur || '')}
                  alt={`${selectedRate?.Cur || ''} flag`}
                  className="w-12 h-12 rounded-full border-2 border-white shadow object-cover"
                />
                <div>
                  <div className="font-bold text-lg text-gray-800">{selectedRate?.Cur || ''}</div>
                  <div className="text-xs text-gray-600">{selectedRate?.Currency || ''}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-gray-500 uppercase">Rate</div>
                <div className="font-bold text-xl text-green-600">{selectedRate?.Rate || ''}</div>
                <div className="text-[10px] text-gray-500">THB</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 rounded-lg p-4 mb-4 border border-amber-200">
            <label className="block text-sm font-bold text-gray-700 mb-1">Currency Code</label>
            <input
              type="text"
              value={customCurrencyCode}
              onChange={(e) => setCustomCurrencyCode?.(e.target.value.toUpperCase())}
              placeholder="e.g. USD, EUR"
              className="w-full px-3 py-2 border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase font-mono font-bold"
            />
          </div>
        )}

        {/* Content */}
        {!showTransactionForm ? (
          <button
            onClick={onNewTransaction}
            className="w-full py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 font-medium text-sm transition"
          >
            + Add Transaction
          </button>
        ) : (
          <TransactionForm
            customRate={customRate}
            setCustomRate={setCustomRate}
            amount={amount}
            setAmount={setAmount}
            transactionType={transactionType}
            setTransactionType={setTransactionType}
            passportNo={passportNo}
            setPassportNo={setPassportNo}
            nationality={nationality}
            setNationality={setNationality}
            customerName={customerName}
            setCustomerName={setCustomerName}
            calculateTotal={calculateTotal}
            onSave={onSaveTransaction}
            onCancel={onCancelTransaction}
            isEditing={isEditing}
          />
        )}
      </div>
    </div>
  )
}
