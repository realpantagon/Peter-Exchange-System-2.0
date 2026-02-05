import { useRef, useEffect } from 'react'
import { countries } from '../../utils/countries'

interface TransactionFormProps {
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
  onSave: () => void
  onCancel: () => void
  isEditing?: boolean
}

export default function TransactionForm({
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
  onSave,
  onCancel,
  isEditing = false
}: TransactionFormProps) {
  const amountInputRef = useRef<HTMLInputElement>(null)

  // Auto-focus amount field when form opens
  useEffect(() => {
    if (amountInputRef.current) {
      amountInputRef.current.focus()
    }
  }, [])

  // Prevent scroll wheel from changing number input values
  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    e.preventDefault()
    e.currentTarget.blur()
  }
  // Form validation
  const isValidForm = customRate.trim() !== '' &&
    amount.trim() !== '' &&
    transactionType !== '' &&
    passportNo.trim() !== '' &&
    parseFloat(customRate) > 0 &&
    parseFloat(amount) > 0

  const handleSave = () => {
    if (isValidForm) {
      onSave()
    }
  }
  return (
    <div className="space-y-3">
      {/* Transaction Type Dropdown */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Transaction Type <span className="text-red-500">*</span>
        </label>
        <select
          value={transactionType}
          onChange={(e) => setTransactionType(e.target.value)}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${transactionType === '' ? 'border-red-300 bg-red-50 text-gray-500' : 'border-gray-300 bg-white text-gray-900'
            }`}
        >
          <option value="" disabled>Select Type --</option>
          <option value="Buying">Buying (รับเงินต่างประเทศ)</option>
          <option value="Selling">Selling (จ่ายเงินต่างประเทศ)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Passport No. <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={passportNo}
          onChange={(e) => setPassportNo(e.target.value)}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${passportNo.trim() === '' ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'}`}
          placeholder="Enter passport number"
          required
        />
        {passportNo.trim() === '' && (
          <p className="mt-1 text-sm text-red-600">Passport number is required</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Nationality
        </label>
        <input
          type="text"
          value={nationality}
          onChange={(e) => setNationality(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
          placeholder="Nationality"
          list={nationality.length > 0 ? "nationality-list" : undefined}
        />
        <datalist id="nationality-list">
          {countries.map((country) => (
            <option key={country} value={country} />
          ))}
        </datalist>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Customer Name
        </label>
        <input
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
          placeholder="Customer Name"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Exchange Rate <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          step="0.0001"
          value={customRate}
          onChange={(e) => setCustomRate(e.target.value)}
          onWheel={handleWheel}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${customRate.trim() === '' || parseFloat(customRate) <= 0
            ? 'border-red-300 bg-red-50'
            : 'border-gray-300'
            }`}
          placeholder="Enter exchange rate"
          required
        />
        {customRate.trim() !== '' && parseFloat(customRate) <= 0 && (
          <p className="mt-1 text-sm text-red-600">Exchange rate must be greater than 0</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Amount <span className="text-red-500">*</span>
        </label>
        <input
          ref={amountInputRef}
          type="number"
          step="1"
          value={amount}
          onChange={(e) => {
            const value = e.target.value
            // Only allow integers (no decimals)
            if (value === '' || /^\d+$/.test(value)) {
              setAmount(value)
            }
          }}
          onWheel={handleWheel}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${amount.trim() === '' || parseFloat(amount) <= 0
            ? 'border-red-300 bg-red-50'
            : 'border-gray-300'
            }`}
          placeholder="Enter amount"
          required
        />
        {amount.trim() !== '' && parseFloat(amount) <= 0 && (
          <p className="mt-1 text-sm text-red-600">Amount must be greater than 0</p>
        )}
      </div>

      <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-xl border border-green-200">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-700 font-medium">Total (THB):</span>
          <span className="font-bold text-2xl text-green-600">฿{calculateTotal()}</span>
        </div>
        <div className="text-sm text-gray-500 text-center">
          {amount || 0} × {customRate || 0} = ฿{calculateTotal()}
        </div>
      </div>

      <div className="flex gap-4 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!isValidForm}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${isValidForm
            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
        >
          {isEditing ? 'Update Transaction' : 'Save Transaction'}
        </button>
      </div>
    </div>
  )
}