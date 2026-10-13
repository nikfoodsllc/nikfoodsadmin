'use client';

import { useAuth } from '@/contexts/AuthContext';
import OrdersPage from './OrdersPage';
import PackerOrdersPage from './PackerOrdersPage';

/** An admin gets the full Orders page; a packer gets the money-free list of confirmed orders. */
export default function OrdersEntry() {
  const { user } = useAuth();
  return user?.role === 'PACKER' ? <PackerOrdersPage /> : <OrdersPage />;
}
