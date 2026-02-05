import type { Rate, Transaction } from '../utils/currencyUtils';

export const MOCK_RATES: Rate[] = [
    { id: 1, Currency: 'US Dollar', Cur: 'USD', Rate: '34.50' },
    { id: 2, Currency: 'Euro', Cur: 'EUR', Rate: '37.80' },
    { id: 3, Currency: 'Japanese Yen', Cur: 'JPY', Rate: '0.23' },
    { id: 4, Currency: 'British Pound', Cur: 'GBP', Rate: '43.20' },
    { id: 5, Currency: 'Australian Dollar', Cur: 'AUD', Rate: '22.50' },
    { id: 6, Currency: 'Singapore Dollar', Cur: 'SGD', Rate: '25.60' },
    { id: 7, Currency: 'Swiss Franc', Cur: 'CHF', Rate: '38.90' },
    { id: 8, Currency: 'Chinese Yuan', Cur: 'CNY', Rate: '4.80' },
    { id: 9, Currency: 'Hong Kong Dollar', Cur: 'HKD', Rate: '4.40' },
    { id: 10, Currency: 'South Korean Won', Cur: 'KRW', Rate: '0.025' },
];

export const MOCK_TRANSACTIONS: Transaction[] = [
    {
        id: 101,
        created_at: new Date().toISOString(),
        Currency: 'US Dollar',
        Cur: 'USD',
        Rate: '34.50',
        Amount: '100',
        Total_TH: '3450',
        Branch: 'Main',
        Transaction_Type: 'Buying',
        Customer_Passport_no: 'A12345678',
        Customer_Nationality: 'USA',
        Customer_Name: 'John Doe'
    },
    {
        id: 102,
        created_at: new Date().toISOString(),
        Currency: 'Euro',
        Cur: 'EUR',
        Rate: '37.80',
        Amount: '50',
        Total_TH: '1890',
        Branch: 'Main',
        Transaction_Type: 'Buying',
        Customer_Passport_no: 'B98765432',
        Customer_Nationality: 'France',
        Customer_Name: 'Jane Smith'
    },
    {
        id: 103,
        created_at: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        Currency: 'Japanese Yen',
        Cur: 'JPY',
        Rate: '0.23',
        Amount: '10000',
        Total_TH: '2300',
        Branch: 'Airport',
        Transaction_Type: 'Selling',
        Customer_Passport_no: 'C11223344',
        Customer_Nationality: 'Japan',
        Customer_Name: 'Tanaka Satoshi'
    }
];
