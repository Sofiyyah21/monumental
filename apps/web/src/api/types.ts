export type UserRole = "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER";
export type ProductUnit = "PACK" | "LITER" | "CUP";
export type SaleStatus = "COMPLETED" | "VOIDED" | "REFUNDED";
export type PaymentMethod = "CASH" | "TRANSFER" | "CARD" | "OTHER";
export type PaymentStatus = "PAID" | "PENDING";
export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export type Permission =
  | "manage:users"
  | "read:products"
  | "manage:products"
  | "read:inventory"
  | "manage:inventory"
  | "read:sales"
  | "create:sales"
  | "read:reports"
  | "read:admin-dashboard";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

export type AuthResponse = {
  user: CurrentUser;
  accessToken: string;
  refreshToken: string;
};

export type ReportPeriod = "today" | "week" | "month" | "year";
export type DashboardPeriod = ReportPeriod | "custom";

export type ReportDateRange = {
  start: string;
  end: string;
};

export type SalesSummaryReport = {
  period: DashboardPeriod;
  range: ReportDateRange;
  salesCount: number;
  unitsSold: string;
  revenue: string;
  cogs: string;
  grossProfit: string;
  discounts: string;
  averageSaleValue: string;
};

export type BestSellerReportItem = {
  rank: number;
  productId: string;
  productName: string;
  unit: ProductUnit;
  quantitySold: string;
  revenue: string;
  cogs: string;
  grossProfit: string;
};

export type BestSellersReport = {
  period: DashboardPeriod;
  range: ReportDateRange;
  rankingMetric: "quantitySold";
  products: BestSellerReportItem[];
};

export type LowStockReportItem = {
  productId: string;
  name: string;
  sku: string;
  unit: ProductUnit;
  currentStock: string;
  reorderLevel: string;
  stockStatus: StockStatus;
};

export type SaleItem = {
  id: string;
  productId: string;
  productName: string;
  productUnit: ProductUnit;
  quantity: string;
  lineTotal: string;
  grossProfit: string;
};

export type Sale = {
  id: string;
  reference: string;
  sellerId: string;
  customerId: string | null;
  status: SaleStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  totalAmount: string;
  grossProfit: string;
  soldAt: string;
  items?: SaleItem[];
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;
