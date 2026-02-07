import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
// import { MOCK_RATES, MOCK_TRANSACTIONS } from '../mocks/data'
import { getRates, getTransactions, createTransaction, updateTransaction } from '../lib/api'
import CurrencyCard from './system_component/CurrencyCard'
import CurrencyModal from './system_component/CurrencyModal'
import TransactionTable from './system_component/TransactionTable'
import Receipt from './system_component/Receipt'
import ReceiptConfigModal, { type ReceiptConfig } from './system_component/ReceiptConfigModal'
import Toast from './system_component/Toast'
import type { Rate, Transaction } from '../utils/currencyUtils'
import { calculateExchangeTotal } from '../utils/currencyUtils'

export default function SystemPage() {
  const [searchParams] = useSearchParams()
  const branchId = searchParams.get('branchid')

  const [rates, setRates] = useState<Rate[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null)
  const [showTransactionForm, setShowTransactionForm] = useState(false)
  const [amount, setAmount] = useState('')
  const [customRate, setCustomRate] = useState('')
  const [transactionType, setTransactionType] = useState('Buying')
  const [passportNo, setPassportNo] = useState('')
  const [nationality, setNationality] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Custom Currency Mode
  const [isCustomCurrencyMode, setIsCustomCurrencyMode] = useState(false)
  const [customCurrencyCode, setCustomCurrencyCode] = useState('')

  // Selection and Printing
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<number[]>([])
  const [transactionsToPrint, setTransactionsToPrint] = useState<Transaction[]>([])
  const [showReceiptConfig, setShowReceiptConfig] = useState(false)
  const [receiptConfig, setReceiptConfig] = useState<ReceiptConfig>({
    showLogo: true,
    companyName: 'ห้างหุ้นส่วนจำกัด ปีเตอร์ เอ็กซ์เชนจ์',
    showAddress: true,
    showDate: true,
    showCustomerInfo: true,
    showTable: true,
    showFooter: true,
    showLocation: true,
    locationText: '8 Nimmanhaemin Rd., Suthep, Mueang\nChiang Mai, Chiang Mai',
    showLicenseNo: true,
    licenseNoText: 'MC325580007',
    showTaxId: true,
    taxIdText: '0503558003166'
  })

  // Edit mode
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

  // Date filtering
  // Date filtering
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(new Date().toDateString()) // Default to Today
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Generate last 4 days including today
  const availableDates = Array.from({ length: 4 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (3 - i)) // -3, -2, -1, 0 (Today)
    return d
  }).reverse() // Today first



  // Filter transactions based on date settings
  const filteredTransactions = transactions.filter(transaction => {
    if (!transaction.created_at) return false

    if (selectedDateFilter) {
      // Filter by specific selected date (from badges)
      const transactionDate = new Date(transaction.created_at).toDateString()
      return transactionDate === selectedDateFilter
    }

    if (dateFrom && dateTo) {
      const transactionDate = new Date(transaction.created_at)
      const fromDate = new Date(dateFrom)
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999) // Include full day
      return transactionDate >= fromDate && transactionDate <= toDate
    }

    return true
  })

  useEffect(() => {
    if (branchId) {
      console.log('SystemPage loaded with branch ID:', branchId)
    }
    fetchRates()
    fetchTransactions()
  }, [branchId])

  const fetchRates = async () => {
    setLoading(true)
    try {
      const data = await getRates()
      setRates(data)
    } catch (error) {
      console.error("Failed to fetch rates", error)
    }
    setLoading(false)
  }

  const fetchTransactions = async () => {
    try {
      // Calculate date 3 days ago
      const date = new Date()
      date.setDate(date.getDate() - 3)
      const startDate = date.toISOString().split('T')[0] // Format YYYY-MM-DD

      const data = await getTransactions(startDate, branchId || undefined)
      setTransactions(data)
    } catch (error) {
      console.error("Failed to fetch transactions", error)
    }
  }

  const handleCardClick = (rate: Rate) => {
    setSelectedRate(rate)
    setCustomRate(rate.Rate || '')
    setShowTransactionForm(false)
  }

  const handleNewTransaction = () => {
    setEditingTransaction(null)
    setShowTransactionForm(true)
    setAmount('')
    setPassportNo('')
    setNationality('')
    setCustomerName('')
    setTransactionType('')
  }

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setSelectedRate({
      id: 0, // We don't need this for editing
      Currency: transaction.Currency,
      Cur: transaction.Cur,
      Rate: transaction.Rate
    } as Rate)
    setCustomRate(transaction.Rate || '')
    setAmount(transaction.Amount || '')
    setPassportNo(transaction.Customer_Passport_no || '')
    setNationality(transaction.Customer_Nationality || '')
    setCustomerName(transaction.Customer_Name || '')
    setTransactionType(transaction.Transaction_Type || '')
    setShowTransactionForm(true)
  }

  const handleCustomCurrencyClick = () => {
    setIsCustomCurrencyMode(true)
    setCustomCurrencyCode('')
    setCustomRate('')
    setAmount('')
    setPassportNo('')
    setNationality('')
    setCustomerName('')
    setTransactionType('Buying')
    setShowTransactionForm(true)
    setEditingTransaction(null)
    setSelectedRate(null)
  }

  const calculateTotal = () => {
    return calculateExchangeTotal(customRate, amount)
  }

  const handleSaveTransaction = async () => {
    // Convert amount to negative if selling, then calculate total from that
    const finalAmount = transactionType === 'Selling' ? `-${amount}` : amount
    const total = calculateExchangeTotal(customRate, finalAmount)

    try {
      const transactionData = {
        Currency: isCustomCurrencyMode ? 'Custom' : (selectedRate?.Currency || editingTransaction?.Currency || ''),
        Cur: isCustomCurrencyMode ? customCurrencyCode : (selectedRate?.Cur || editingTransaction?.Cur || ''),
        Rate: customRate,
        Amount: finalAmount,
        Total_TH: total,
        Branch: branchId || null,
        Transaction_Type: transactionType,
        Customer_Passport_no: passportNo,
        Customer_Nationality: nationality,
        Customer_Name: customerName
      }

      // await new Promise(resolve => setTimeout(resolve, 500));
      const actionText = editingTransaction ? 'updated' : 'created';

      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, transactionData)
      } else {
        await createTransaction(transactionData)
      }

      console.log(`Transaction ${actionText} successfully`);

      // Refresh transactions
      await fetchTransactions();

      // Reset form and close modal
      setShowTransactionForm(false)
      setAmount('')
      setPassportNo('')
      setNationality('')
      setCustomerName('')
      setSelectedRate(null)
      setEditingTransaction(null)
      setIsCustomCurrencyMode(false)
      setCustomCurrencyCode('')

      // Show success message
      const currency = selectedRate?.Cur || editingTransaction?.Currency || ''
      const branchInfo = branchId ? `\nBranch ID: ${branchId}` : ''
      setToast({
        message: `Transaction ${actionText.charAt(0).toUpperCase() + actionText.slice(1)} Successfully!\nCurrency: ${currency}\nAmount: ${amount}\nRate: ${customRate}\nTotal THB: ${total}${branchInfo}`,
        type: 'success'
      })
    } catch (error) {
      console.error('Failed to save transaction:', error)
      setToast({ message: 'Failed to save transaction. Please try again.', type: 'error' })
    }
  }



  // Don't show loading overlay, let individual components handle their loading states

  const handleToggleSelect = (id: number) => {
    setSelectedTransactionIds(prev =>
      prev.includes(id)
        ? prev.filter(tid => tid !== id)
        : [...prev, id]
    )
  }

  const handlePrintSingle = (transaction: Transaction) => {
    setTransactionsToPrint([transaction])
    setTimeout(() => {
      window.print()
    }, 100)
  }

  const handlePrintSelected = () => {
    const selected = transactions.filter(t => t.id && selectedTransactionIds.includes(t.id))
    if (selected.length === 0) return

    setTransactionsToPrint(selected)
    setTimeout(() => {
      window.print()
    }, 100)
  }

  const handleSelectAll = (ids: number[]) => {
    // Check if all these IDs are already selected
    const allSelected = ids.every(id => selectedTransactionIds.includes(id))

    if (allSelected) {
      // Unselect all these IDs
      setSelectedTransactionIds(prev => prev.filter(id => !ids.includes(id)))
    } else {
      // Select all these IDs (merging with existing selection)
      const newIds = ids.filter(id => !selectedTransactionIds.includes(id))
      setSelectedTransactionIds(prev => [...prev, ...newIds])
    }
  }

  const selectedTransactionsList = transactions.filter(t => t.id && selectedTransactionIds.includes(t.id))
  const selectedTotal = selectedTransactionsList.reduce((sum, t) => sum + parseFloat(t.Total_TH || '0'), 0)

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div className="print:hidden min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 flex gap-4">
        {/* Sidebar - 1/5 of screen */}
        <div className="w-1/5 flex flex-col h-[calc(100vh-2rem)]">
          <div className="mb-3 flex flex-col items-center flex-shrink-0 gap-2">
            <button
              onClick={() => {
                fetchRates()
                fetchTransactions()
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>


          </div>

          {/* Currency cards */}
          <div className="flex-1 flex flex-col gap-2 overflow-y-auto bg-white rounded-lg shadow-sm border border-gray-200 p-3 min-h-0">
            {/* <h3 className="text-sm font-semibold text-gray-700 mb-2">Exchange Rates</h3> */}
            {rates.sort((a, b) => a.id - b.id).map((rate) => (
              <CurrencyCard
                key={rate.id}
                rate={rate}
                isSelected={selectedRate?.id === rate.id}
                onClick={handleCardClick}
              />
            ))}

            {/* Custom Currency Button (Moved) */}
            <button
              onClick={handleCustomCurrencyClick}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 text-indigo-700 border-2 border-dashed border-indigo-300 rounded-xl hover:bg-indigo-100 transition-all font-bold mt-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Custom Rate (+ Add)</span>
            </button>
          </div>
        </div>

        {/* Transaction Table - 4/5 of screen */}
        <TransactionTable
          transactions={filteredTransactions}
          loading={loading}
          onRefresh={() => {
            fetchRates()
            fetchTransactions()
          }}
          branchId={branchId}
          selectedDateFilter={selectedDateFilter}
          setSelectedDateFilter={setSelectedDateFilter}
          availableDates={availableDates}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          onEditTransaction={handleEditTransaction}
          selectedTransactionIds={selectedTransactionIds}
          onToggleSelect={handleToggleSelect}
          onPrintSingle={handlePrintSingle}
          onSelectAll={handleSelectAll}
          onCustomizeReceipt={() => setShowReceiptConfig(true)}
          onPrintSelected={handlePrintSelected}
          onClearSelection={() => setSelectedTransactionIds([])}
          selectedCount={selectedTransactionsList.length}
          selectedTotal={selectedTotal}
        />

        {/* Modal */}
        <CurrencyModal
          selectedRate={selectedRate}
          onClose={() => {
            setSelectedRate(null)
            setEditingTransaction(null)
            setIsCustomCurrencyMode(false)
          }}
          showTransactionForm={showTransactionForm}
          onNewTransaction={handleNewTransaction}
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
          onSaveTransaction={handleSaveTransaction}
          onCancelTransaction={() => {
            setShowTransactionForm(false)
            setEditingTransaction(null)
            setIsCustomCurrencyMode(false)
          }}
          isEditing={!!editingTransaction}
          isCustomCurrency={isCustomCurrencyMode}
          customCurrencyCode={customCurrencyCode}
          setCustomCurrencyCode={setCustomCurrencyCode}
        />

      </div>



      {/* Print Layout - Hidden in screen, visible in print */}
      <div className="hidden print:block absolute top-0 left-0 w-auto h-auto bg-white z-50">
        {transactionsToPrint.length > 0 && (
          <div>
            <Receipt transactions={transactionsToPrint} config={receiptConfig} />
          </div>
        )}
      </div>

      <ReceiptConfigModal
        isOpen={showReceiptConfig}
        onClose={() => setShowReceiptConfig(false)}
        config={receiptConfig}
        setConfig={setReceiptConfig}
      />
    </>
  )
}
