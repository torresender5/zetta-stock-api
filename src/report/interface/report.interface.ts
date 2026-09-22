export interface SalesByPeriodRow {
  date: string;
  count: number;
  subtotal: number;
  tax: number;
  total: number;
}

export interface SalesSummary {
  startDate: string;
  endDate: string;
  totalSales: number;
  totalCount: number;
  subtotal: number;
  tax: number;
  byPaymentMethod: Record<string, number>;
  byPaymentStatus: Record<string, number>;
  byPeriod: SalesByPeriodRow[];
}

export interface TopProductRow {
  productId: number;
  name: string;
  quantity: number;
  revenue: number;
}

export interface PurchaseBySupplierRow {
  supplierId: number;
  supplier: string;
  count: number;
  total: number;
}

export interface PurchasesSummary {
  startDate: string;
  endDate: string;
  totalPurchases: number;
  totalCount: number;
  subtotal: number;
  tax: number;
  byPaymentStatus: Record<string, number>;
  bySupplier: PurchaseBySupplierRow[];
}

export interface InventoryRow {
  productId: number;
  name: string;
  code: string;
  category: string;
  stock: number;
  purchasePrice: number;
  stockValue: number;
  lowStock: boolean;
}

export interface InventoryReport {
  products: InventoryRow[];
  totalItems: number;
  totalStock: number;
  totalStockValue: number;
  lowStockCount: number;
}

export interface CashRegisterReportRow {
  id: number;
  name: string;
  status: string;
  user: string;
  openedAt: string;
  closedAt: string | null;
  baseAmount: number;
  expectedTotal: number | null;
  countedTotal: number | null;
  difference: number | null;
}

export interface CashRegisterReport {
  cashRegisters: CashRegisterReportRow[];
  count: number;
}

export interface AgingRow {
  id: number;
  name: string;
  pendingCount: number;
  total: number;
  current: number;
  days30: number;
  days60: number;
  days90: number;
}

export interface ReceivablesReport {
  startDate: string;
  endDate: string;
  rows: AgingRow[];
  total: number;
}

export interface PayablesReport {
  startDate: string;
  endDate: string;
  rows: AgingRow[];
  total: number;
}

export interface ApartadoReportRow {
  id: number;
  apartadoNumber: string;
  client: string;
  date: string;
  total: number;
  totalPaid: number;
  balance: number;
  status: string;
}

export interface ApartadoReport {
  rows: ApartadoReportRow[];
  totalActive: number;
  totalBalance: number;
}
