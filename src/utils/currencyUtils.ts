import type { PeterExchangeRate, PeterExchangeTransaction } from '../types/database'

export type Rate = PeterExchangeRate
export type Transaction = PeterExchangeTransaction

export const getFlagIcon = (currencyCode: string): string => {
  const baseUrl = ''
  const flagMap: { [key: string]: string } = {
    AUD: `${baseUrl}/AUD.png`,
    CAD: `${baseUrl}/CAD.png`,
    CHF: `${baseUrl}/CHF.png`,
    CNY: `${baseUrl}/CNY.png`,
    EUR: `${baseUrl}/EUR.png`,
    GBP: `${baseUrl}/GBP.png`,
    HKD: `${baseUrl}/HKD.png`,
    JPY: `${baseUrl}/JPY.png`,
    KRW: `${baseUrl}/KRW.png`,
    MYR: `${baseUrl}/MYR.png`,
    NZD: `${baseUrl}/NZD.png`,
    SGD: `${baseUrl}/SGD.png`,
    TWD: `${baseUrl}/TWD.png`,
    USD: `${baseUrl}/USA.png`,
    USD2: `${baseUrl}/USA.png`,
    USD1: `${baseUrl}/USA.png`,
  }
  return flagMap[currencyCode] || `${baseUrl}/vite.svg`
}

export const calculateExchangeTotal = (rate: string, amount: string): string => {
  const rateValue = parseFloat(rate) || 0
  const amountValue = parseFloat(amount) || 0
  const total = rateValue * amountValue
  // Round down the total to integer
  return Math.floor(total).toString()
}