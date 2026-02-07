import type { Transaction } from '../../utils/currencyUtils'
import type { ReceiptConfig } from './ReceiptConfigModal'

interface ReceiptProps {
    transactions: Transaction[]
    config?: ReceiptConfig
}

export default function Receipt({ transactions, config }: ReceiptProps) {
    // Default config if not provided
    const {
        showLogo = true,
        showAddress = true,
        showDate = true,
        showCustomerInfo = true,
        showFooter = true,
        showLocation = true,
        locationText = '8 Nimmanhaemin Rd., Suthep, Mueang\nChiang Mai, Chiang Mai',
        showLicenseNo = true,
        licenseNoText = 'MC325580007',
        showTaxId = true,
        taxIdText = '0503558003166'
    } = config || {}

    const now = new Date()
    const currentDate = now.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
    })
    const currentTime = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    })

    const grandTotal = transactions.reduce(
        (sum, t) => sum + Number(t.Total_TH || 0),
        0
    )

    const customer = transactions[0]


    const paperSize = config?.paperSize || '80mm'
    const isSmall = paperSize === '58mm'

    return (
        <>
            <style>
                {`
@media print {
  @page {
    margin: 0;
    size: ${paperSize} auto;
  }

  html, body {
    width: ${paperSize};
    margin: 0;
    padding: 0;
    color: #000;
    background: #fff;
    zoom: 1;
  }

  .receipt {
    font-family: sans-serif;
    text-rendering: optimizeSpeed;
    -webkit-font-smoothing: antialiased;
    letter-spacing: 0;
  }
}
        `}
            </style>

            <div className={`receipt ${isSmall ? 'w-[58mm] text-[11px]' : 'w-[80mm] text-[13px]'} px-4 py-2 text-black leading-snug flex flex-col items-center`}>
                {/* Header */}
                <div className="w-full flex flex-col items-center text-center mb-2">
                    {showLogo && (
                        <>
                            <img
                                src="/bdge_png.png"
                                alt="Peter Exchange"
                                className="w-40 mb-2"
                            />
                        </>
                    )}
                    {showAddress && (
                        <>
                            <p className="font-bold">{config?.companyName || 'ห้างหุ้นส่วนจำกัด ปีเตอร์ เอ็กซ์เชนจ์'}</p>
                            {showLocation && <p className="text-[11px] whitespace-pre-wrap">{locationText}</p>}
                            {showLicenseNo && <p className="text-[11px]">License no.{licenseNoText}</p>}
                            {showTaxId && <p className="text-[11px]">เลขประจำตัวผู้เสียภาษี: {taxIdText}</p>}
                            <p className="font-bold text-[13px]">Tel: 081-951-9678</p>
                        </>
                    )}
                    {showDate && (
                        <p className="text-[12px] mt-1">
                            Date: {currentDate}, {currentTime}
                        </p>
                    )}
                </div>

                {/* Customer Info */}
                {showCustomerInfo && (
                    <div className="w-full text-left text-[12px] leading-normal mb-3">
                        <p>Name: <span className=" text-[12px]">{customer?.Customer_Name || '____________________'}</span></p>
                        <p>Passport No.: {customer?.Customer_Passport_no || '____________________'}</p>
                        <p>Nationality: {customer?.Customer_Nationality || '____________________'}</p>
                    </div>
                )}

                {/* Table */}
                <div className="w-full">
                    {/* Table Header */}
                    <div className="flex border-b border-black pb-1 mb-1 font-bold text-[13px]">
                        <div className="w-[20%] text-center">Currency</div>
                        <div className="w-[20%] text-center">Rate</div>
                        <div className="w-[30%] text-center">Amount</div>
                        <div className="w-[30%] text-right">THB</div>
                    </div>

                    {/* Rows */}
                    {transactions.map((t, i) => (
                        <div key={i} className="flex mb-1 text-[13px]">
                            <div className="w-[20%] text-center">{t.Cur}</div>
                            <div className="w-[20%] text-center">{Number(t.Rate).toFixed(3)}</div>
                            <div className="w-[30%] text-center">{Number(t.Amount).toLocaleString()}</div>
                            <div className="w-[30%] text-right">
                                {Number(t.Total_TH).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Divider */}
                    <div className="border-t border-black my-2"></div>

                    {/* Total */}
                    <div className="flex justify-between items-center text-[14px] font-bold">
                        <span>Total:</span>
                        <span>{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB</span>
                    </div>
                    <div className="border-b border-black mt-2"></div>
                </div>

                {/* Footer */}
                {showFooter && (
                    <div className="w-full mt-6 text-center text-[13px]">
                        <div className="">
                            <div className="border-b border-black w-full mt-8"></div>
                            <p className="">Customer Signature</p>
                        </div>
                        {/* <div>
                            <p className="mb-4">Phone Number:</p>
                            <div className="border-b border-black w-full"></div>
                        </div> */}
                    </div>
                )}
            </div>
        </>
    )
}
