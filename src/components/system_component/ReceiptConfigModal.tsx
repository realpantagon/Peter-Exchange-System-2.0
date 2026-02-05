
export interface ReceiptConfig {
    showLogo: boolean
    companyName: string
    showAddress: boolean
    showDate: boolean
    showCustomerInfo: boolean
    showTable: boolean
    showFooter: boolean
    showLocation: boolean
    locationText: string
    showLicenseNo: boolean
    licenseNoText: string
    showTaxId: boolean
    taxIdText: string
}

interface ReceiptConfigModalProps {
    config: ReceiptConfig
    setConfig: (config: ReceiptConfig) => void
    isOpen: boolean
    onClose: () => void
}

export default function ReceiptConfigModal({ config, setConfig, isOpen, onClose }: ReceiptConfigModalProps) {
    if (!isOpen) return null

    const handleToggle = (key: keyof ReceiptConfig) => {
        if (typeof config[key] === 'boolean') {
            setConfig({ ...config, [key]: !config[key] })
        }
    }

    const handleChange = (key: keyof ReceiptConfig, value: string) => {
        setConfig({ ...config, [key]: value })
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-xl shadow-xl p-6 w-[500px] max-w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Customize Receipt</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => handleToggle('showLogo')}>
                        <span className="font-medium text-gray-700">Show Logo</span>
                        <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${config.showLogo ? 'bg-blue-600' : 'bg-gray-300'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${config.showLogo ? 'translate-x-5' : ''}`}></div>
                        </div>
                    </div>

                    {/* Header Info Section */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => handleToggle('showAddress')}>
                            <span className="font-medium text-gray-700">Show Header Information</span>
                            <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${config.showAddress ? 'bg-blue-600' : 'bg-gray-300'}`}>
                                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${config.showAddress ? 'translate-x-5' : ''}`}></div>
                            </div>
                        </div>

                        {config.showAddress && (
                            <div className="p-3 bg-white space-y-3">
                                {/* Address Presets */}
                                <div className="flex gap-2 mb-2">
                                    <button
                                        onClick={() => {
                                            setConfig({
                                                ...config,
                                                companyName: 'ห้างหุ้นส่วนจำกัด ปีเตอร์ เอ็กซ์เชนจ์',
                                                locationText: '8 Nimmanhaemin Rd., Suthep, Mueang\nChiang Mai, Chiang Mai',
                                                licenseNoText: 'MC325580007',
                                                taxIdText: '0503558003166'
                                            })
                                        }}
                                        className="flex-1 py-1.5 px-2 text-xs font-bold border rounded hover:bg-gray-50 transition-colors text-blue-700 border-blue-200 bg-blue-50"
                                    >
                                        Set 1 (ร้านฟ้า)
                                    </button>
                                    <button
                                        onClick={() => {
                                            setConfig({
                                                ...config,
                                                companyName: 'ห้างหุ้นส่วนจำกัด ปีเตอร์ มันนี่',
                                                locationText: 'No. 45/K6 Nimmanhaemin Rd., Suthep,\nMueang Chiang Mai, Chiang Mai',
                                                licenseNoText: 'MC325660002',
                                                taxIdText: '0503566001592'
                                            })
                                        }}
                                        className="flex-1 py-1.5 px-2 text-xs font-bold border rounded hover:bg-gray-50 transition-colors text-yellow-700 border-yellow-200 bg-yellow-50"
                                    >
                                        Set 2 (ร้านเหลือง)
                                    </button>
                                </div>

                                {/* Company Name */}
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Company Name</label>
                                    <input
                                        type="text"
                                        value={config.companyName}
                                        onChange={(e) => handleChange('companyName', e.target.value)}
                                        className="w-full text-sm p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-gray-500"
                                    />
                                </div>

                                {/* Location */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-gray-500 uppercase">Location</label>
                                        <div className="cursor-pointer" onClick={() => handleToggle('showLocation')}>
                                            <div className={`w-8 h-4 flex items-center rounded-full p-0.5 transition-colors duration-300 ${config.showLocation ? 'bg-blue-500' : 'bg-gray-300'}`}>
                                                <div className={`bg-white w-3 h-3 rounded-full shadow-md transform duration-300 ${config.showLocation ? 'translate-x-4' : ''}`}></div>
                                            </div>
                                        </div>
                                    </div>
                                    <textarea
                                        value={config.locationText}
                                        onChange={(e) => handleChange('locationText', e.target.value)}
                                        disabled={!config.showLocation}
                                        className={`w-full text-sm p-2 border rounded-md ${!config.showLocation ? 'bg-gray-100 text-gray-400' : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-gray-500'}`}
                                        rows={2}
                                    />
                                </div>

                                {/* License No */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-gray-500 uppercase">License No.</label>
                                        <div className="cursor-pointer" onClick={() => handleToggle('showLicenseNo')}>
                                            <div className={`w-8 h-4 flex items-center rounded-full p-0.5 transition-colors duration-300 ${config.showLicenseNo ? 'bg-blue-500' : 'bg-gray-300'}`}>
                                                <div className={`bg-white w-3 h-3 rounded-full shadow-md transform duration-300 ${config.showLicenseNo ? 'translate-x-4' : ''}`}></div>
                                            </div>
                                        </div>
                                    </div>
                                    <input
                                        type="text"
                                        value={config.licenseNoText}
                                        onChange={(e) => handleChange('licenseNoText', e.target.value)}
                                        disabled={!config.showLicenseNo}
                                        className={`w-full text-sm p-2 border rounded-md ${!config.showLicenseNo ? 'bg-gray-100 text-gray-400' : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-gray-500'}`}
                                    />
                                </div>

                                {/* Tax ID */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-gray-500 uppercase">Tax ID</label>
                                        <div className="cursor-pointer" onClick={() => handleToggle('showTaxId')}>
                                            <div className={`w-8 h-4 flex items-center rounded-full p-0.5 transition-colors duration-300 ${config.showTaxId ? 'bg-blue-500' : 'bg-gray-300'}`}>
                                                <div className={`bg-white w-3 h-3 rounded-full shadow-md transform duration-300 ${config.showTaxId ? 'translate-x-4' : ''}`}></div>
                                            </div>
                                        </div>
                                    </div>
                                    <input
                                        type="text"
                                        value={config.taxIdText}
                                        onChange={(e) => handleChange('taxIdText', e.target.value)}
                                        disabled={!config.showTaxId}
                                        className={`w-full text-sm p-2 border rounded-md ${!config.showTaxId ? 'bg-gray-100 text-gray-400' : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-gray-500'}`}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => handleToggle('showDate')}>
                        <span className="font-medium text-gray-700">Show Date & Time</span>
                        <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${config.showDate ? 'bg-blue-600' : 'bg-gray-300'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${config.showDate ? 'translate-x-5' : ''}`}></div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => handleToggle('showCustomerInfo')}>
                        <span className="font-medium text-gray-700">Show Customer Info</span>
                        <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${config.showCustomerInfo ? 'bg-blue-600' : 'bg-gray-300'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${config.showCustomerInfo ? 'translate-x-5' : ''}`}></div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => handleToggle('showTable')}>
                        <span className="font-medium text-gray-700">Show Transaction Table</span>
                        <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${config.showTable ? 'bg-blue-600' : 'bg-gray-300'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${config.showTable ? 'translate-x-5' : ''}`}></div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => handleToggle('showFooter')}>
                        <span className="font-medium text-gray-700">Show Footer (Signature)</span>
                        <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${config.showFooter ? 'bg-blue-600' : 'bg-gray-300'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${config.showFooter ? 'translate-x-5' : ''}`}></div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    )
}
