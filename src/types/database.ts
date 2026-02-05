export type PeterExchangeRate = {
    id: number
    Currency: string | null
    Cur: string | null
    Rate: string | null
}

export type PeterExchangeTransaction = {
    id: number
    created_at: string
    Currency: string | null
    Rate: string | null
    Amount: string | null
    Total_TH: string | null
    Branch: string | null
    Transaction_Type: string | null
    Cur: string | null
    Customer_Passport_no: string | null
    Customer_Nationality: string | null
    Customer_Name: string | null
}
