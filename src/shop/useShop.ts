import { useContext } from 'react'
import { ShopContext, type ShopState } from './shopContext'

export function useShop(): ShopState {
  const value = useContext(ShopContext)
  if (!value) throw new Error('useShop must be used inside <ShopProvider>')
  return value
}
