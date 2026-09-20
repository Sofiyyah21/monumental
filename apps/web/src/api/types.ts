export type UserRole = "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER";
export type ProductCategory = "DRINKS" | "NOODLES" | "VEGETABLE_OIL" | "SUGAR";
export type ProductUnit = "PACK" | "LITER" | "CUP";
export type CustomerProductAvailability = "AVAILABLE" | "OUT_OF_STOCK";
export type SaleStatus = "COMPLETED" | "VOIDED";
export type OrderStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "FULFILLED";
export type PaymentMethod = "CASH" | "TRANSFER" | "CARD" | "OTHER";
export type PaymentStatus = "PAID" | "PENDING";
export type OrderPaymentStatus = "UNPAID" | "PAID" | "FAILED";
export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
export type StockMovementType =
  "RECEIVED" | "SOLD" | "ADJUSTMENT" | "RETURN" | "DAMAGE";

export type Permission =
  | "manage:users"
  | "read:products"
  | "manage:products"
  | "read:inventory"
  | "manage:inventory"
  | "read:sales"
  | "create:sales"
  | "void:sales"
  | "read:orders"
  | "manage:orders"
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
  saleId?: string;
  productId: string;
  productName: string;
  productUnit: ProductUnit;
  quantity: string;
  unitPrice: string;
  unitCost?: string;
  lineTotal: string;
  lineCost?: string;
  grossProfit: string;
};

export type SaleUserSnapshot = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type Sale = {
  id: string;
  reference: string;
  sellerId: string;
  customerId: string | null;
  status: SaleStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference?: string | null;
  subtotal: string;
  discountAmount: string;
  totalAmount: string;
  totalCost?: string;
  grossProfit: string;
  voidedAt?: string | null;
  voidedById?: string | null;
  voidReason?: string | null;
  soldAt: string;
  createdAt?: string;
  updatedAt?: string;
  items?: SaleItem[];
  seller?: SaleUserSnapshot;
  customer?: SaleUserSnapshot | null;
  voidedBy?: SaleUserSnapshot | null;
};

export type SaleFilters = {
  sellerId?: string;
  customerId?: string;
  status?: SaleStatus;
  paymentStatus?: PaymentStatus;
  from?: string;
  to?: string;
  limit?: number;
};

export type CreateSaleInput = {
  customerId?: string;
  paymentMethod: PaymentMethod;
  paymentStatus?: PaymentStatus;
  paymentReference?: string;
  discountAmount?: number;
  soldAt?: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
};

export type VoidSaleInput = {
  reason: string;
};

export type OrderItem = {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productCategory: ProductCategory;
  productUnit: ProductUnit;
  quantity: string;
  unitPrice: string;
  lineSubtotal: string;
  createdAt: string;
};

export type OrderUserSnapshot = {
  id: string;
  name?: string;
  email?: string;
  role?: UserRole;
};

export type Order = {
  id: string;
  reference: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  paymentMethod?: PaymentMethod | null;
  subtotal: string;
  customerId?: string;
  customer?: OrderUserSnapshot | null;
  confirmedAt?: string | null;
  confirmedById?: string | null;
  confirmedBy?: OrderUserSnapshot | null;
  paidAt?: string | null;
  paidById?: string | null;
  paidBy?: OrderUserSnapshot | null;
  saleId?: string | null;
  saleReference?: string | null;
  fulfilledAt?: string | null;
  fulfilledById?: string | null;
  fulfilledBy?: OrderUserSnapshot | null;
  cancelledAt: string | null;
  cancelledById?: string | null;
  cancelledBy?: OrderUserSnapshot | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
};

export type CreateOrderInput = {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
};

export type OrderFilters = {
  status?: OrderStatus;
  paymentStatus?: OrderPaymentStatus;
  customerId?: string;
  from?: string;
  to?: string;
  limit?: number;
};

export type CancelOrderInput = {
  reason?: string;
};

export type Product = {
  id: string;
  name: string;
  sku: string;
  category: ProductCategory;
  unit: ProductUnit;
  costPrice: string;
  sellingPrice: string;
  currentStock: string;
  reorderLevel: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomerCatalogProduct = {
  id: string;
  name: string;
  sku: string;
  category: ProductCategory;
  unit: ProductUnit;
  sellingPrice: string;
  availability: CustomerProductAvailability;
};

export type ProductFilters = {
  search?: string;
  category?: ProductCategory;
  unit?: ProductUnit;
  active?: boolean;
};

export type ProductInput = {
  name: string;
  sku: string;
  category: ProductCategory;
  unit: ProductUnit;
  costPrice: number;
  sellingPrice: number;
  reorderLevel: number;
};

export type ProductUpdateInput = Partial<ProductInput> & {
  active?: boolean;
};

export type InventoryItem = {
  productId: string;
  name: string;
  sku: string;
  category: ProductCategory;
  unit: ProductUnit;
  currentStock: string;
  reorderLevel: string;
  lowStock: boolean;
  active: boolean;
};

export type InventoryFilters = {
  active?: boolean;
  lowStock?: boolean;
};

export type InventoryUserSnapshot = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type StockMovement = {
  id: string;
  productId: string;
  type: StockMovementType;
  quantity: string;
  previousStock: string;
  newStock: string;
  unitCost: string | null;
  reference: string | null;
  note: string | null;
  saleId: string | null;
  createdById: string | null;
  occurredAt: string;
  product?: Product;
  createdBy?: InventoryUserSnapshot | null;
};

export type StockMovementFilters = {
  productId?: string;
  type?: StockMovementType;
  from?: string;
  to?: string;
  limit?: number;
};

export type StockReceiptInput = {
  productId: string;
  quantity: number;
  unit: ProductUnit;
  unitCost?: number;
  reference?: string;
  note?: string;
};

export type StockAdjustmentInput = {
  productId: string;
  quantityChange: number;
  unit: ProductUnit;
  reason: string;
  reference?: string;
};

export type StockReturnInput = {
  productId: string;
  quantity: number;
  unit: ProductUnit;
  reference?: string;
  note?: string;
};

export type StockDamageInput = {
  productId: string;
  quantity: number;
  unit: ProductUnit;
  reason: string;
  reference?: string;
};

export type InventoryMutationResult = {
  product: Product;
  movement: StockMovement;
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
