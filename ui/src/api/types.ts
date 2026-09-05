export type OrderStatus = 'PENDING' | 'FULFILLED' | 'FAILED' | 'CANCELLED';

export interface Order {
  id: string;
  productId: string;
  quantity: number;
  customerEmail: string;
  status: OrderStatus;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedOrders {
  data: Order[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateOrderInput {
  productId: string;
  quantity: number;
  customerEmail: string;
}

export interface InventoryItem {
  productId: string;
  available: number;
  [key: string]: unknown;
}
