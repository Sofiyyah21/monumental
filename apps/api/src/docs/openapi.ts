export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Monumental Details Shop Management API",
    version: "0.1.0",
    description:
      "Backend API for Monumental Details retail inventory, sales, auth, and reporting.",
  },
  servers: [{ url: "/api/v1" }],
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "Products" },
    { name: "Inventory" },
    { name: "Orders" },
    { name: "Sales" },
    { name: "Reports" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
      refreshCookie: {
        type: "apiKey",
        in: "cookie",
        name: "md_refresh_token",
        description:
          "HttpOnly refresh-token cookie set by /auth/login and rotated by /auth/refresh.",
      },
    },
    schemas: {
      ProductCategory: {
        type: "string",
        enum: ["DRINKS", "NOODLES", "VEGETABLE_OIL", "SUGAR"],
      },
      ProductUnit: {
        type: "string",
        enum: ["PACK", "LITER", "CUP"],
      },
      StockMovementType: {
        type: "string",
        enum: ["RECEIVED", "SOLD", "ADJUSTMENT", "RETURN", "DAMAGE"],
      },
      Product: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          sku: { type: "string" },
          category: { $ref: "#/components/schemas/ProductCategory" },
          unit: { $ref: "#/components/schemas/ProductUnit" },
          costPrice: { type: "string", example: "100.00" },
          sellingPrice: { type: "string", example: "150.00" },
          currentStock: { type: "string", example: "0.000" },
          reorderLevel: { type: "string", example: "5.000" },
          active: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CustomerCatalogProduct: {
        type: "object",
        description:
          "Customer-safe active product projection returned to CUSTOMER users by GET /products.",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          sku: { type: "string" },
          category: { $ref: "#/components/schemas/ProductCategory" },
          unit: { $ref: "#/components/schemas/ProductUnit" },
          sellingPrice: { type: "string", example: "150.00" },
          availability: {
            type: "string",
            enum: ["AVAILABLE", "OUT_OF_STOCK"],
          },
        },
      },
      ProductInput: {
        type: "object",
        required: [
          "name",
          "sku",
          "category",
          "unit",
          "costPrice",
          "sellingPrice",
        ],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 120 },
          sku: {
            type: "string",
            minLength: 1,
            maxLength: 64,
            pattern: "^[A-Z0-9][A-Z0-9_-]*$",
          },
          category: { $ref: "#/components/schemas/ProductCategory" },
          unit: {
            $ref: "#/components/schemas/ProductUnit",
            description:
              "Must match category: DRINKS/NOODLES use PACK, VEGETABLE_OIL uses LITER, SUGAR uses CUP.",
          },
          costPrice: { type: "number", minimum: 0, multipleOf: 0.01 },
          sellingPrice: { type: "number", minimum: 0, multipleOf: 0.01 },
          reorderLevel: { type: "number", minimum: 0, default: 0 },
        },
      },
      ProductUpdateInput: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 120 },
          sku: {
            type: "string",
            minLength: 1,
            maxLength: 64,
            pattern: "^[A-Z0-9][A-Z0-9_-]*$",
          },
          category: { $ref: "#/components/schemas/ProductCategory" },
          unit: {
            $ref: "#/components/schemas/ProductUnit",
            description:
              "Must match category: DRINKS/NOODLES use PACK, VEGETABLE_OIL uses LITER, SUGAR uses CUP.",
          },
          costPrice: { type: "number", minimum: 0, multipleOf: 0.01 },
          sellingPrice: { type: "number", minimum: 0, multipleOf: 0.01 },
          reorderLevel: { type: "number", minimum: 0 },
          active: { type: "boolean" },
        },
      },
      InventoryItem: {
        type: "object",
        properties: {
          productId: { type: "string" },
          name: { type: "string" },
          sku: { type: "string" },
          category: { $ref: "#/components/schemas/ProductCategory" },
          unit: { $ref: "#/components/schemas/ProductUnit" },
          currentStock: { type: "string", example: "12.000" },
          reorderLevel: { type: "string", example: "5.000" },
          lowStock: { type: "boolean" },
          active: { type: "boolean" },
        },
      },
      StockMovement: {
        type: "object",
        properties: {
          id: { type: "string" },
          productId: { type: "string" },
          type: { $ref: "#/components/schemas/StockMovementType" },
          quantity: { type: "string", example: "5.000" },
          previousStock: { type: "string", example: "10.000" },
          newStock: { type: "string", example: "15.000" },
          unitCost: { type: "string", nullable: true, example: "95.00" },
          reference: { type: "string", nullable: true },
          note: { type: "string", nullable: true },
          saleId: { type: "string", nullable: true },
          createdById: { type: "string", nullable: true },
          occurredAt: { type: "string", format: "date-time" },
        },
      },
      StockReceiptInput: {
        type: "object",
        required: ["productId", "quantity", "unit"],
        properties: {
          productId: { type: "string" },
          quantity: { type: "number", exclusiveMinimum: 0 },
          unit: { $ref: "#/components/schemas/ProductUnit" },
          unitCost: { type: "number", minimum: 0, multipleOf: 0.01 },
          reference: { type: "string", minLength: 1, maxLength: 120 },
          note: { type: "string", maxLength: 500 },
        },
      },
      StockReturnInput: {
        type: "object",
        required: ["productId", "quantity", "unit"],
        properties: {
          productId: { type: "string" },
          quantity: { type: "number", exclusiveMinimum: 0 },
          unit: { $ref: "#/components/schemas/ProductUnit" },
          reference: { type: "string", minLength: 1, maxLength: 120 },
          note: { type: "string", maxLength: 500 },
        },
      },
      StockAdjustmentInput: {
        type: "object",
        required: ["productId", "quantityChange", "unit", "reason"],
        properties: {
          productId: { type: "string" },
          quantityChange: {
            type: "number",
            description:
              "Positive values increase stock; negative values reduce stock. Zero is rejected.",
          },
          unit: { $ref: "#/components/schemas/ProductUnit" },
          reason: { type: "string", minLength: 1, maxLength: 500 },
          reference: { type: "string", minLength: 1, maxLength: 120 },
        },
      },
      StockDamageInput: {
        type: "object",
        required: ["productId", "quantity", "unit", "reason"],
        properties: {
          productId: { type: "string" },
          quantity: { type: "number", exclusiveMinimum: 0 },
          unit: { $ref: "#/components/schemas/ProductUnit" },
          reason: { type: "string", minLength: 1, maxLength: 500 },
          reference: { type: "string", minLength: 1, maxLength: 120 },
        },
      },
      UserRole: {
        type: "string",
        enum: ["ADMIN", "MANAGER", "STAFF", "CUSTOMER"],
      },
      PaymentMethod: {
        type: "string",
        enum: ["CASH", "TRANSFER", "CARD", "OTHER"],
      },
      PaymentStatus: {
        type: "string",
        enum: ["PAID", "PENDING"],
      },
      OrderStatus: {
        type: "string",
        enum: ["PENDING", "CONFIRMED", "CANCELLED", "FULFILLED"],
      },
      OrderPaymentStatus: {
        type: "string",
        enum: ["UNPAID", "PAID", "FAILED"],
      },
      OrderItem: {
        type: "object",
        description:
          "Customer-safe historical product snapshot captured when the order was created.",
        properties: {
          id: { type: "string" },
          productId: { type: "string" },
          productName: { type: "string" },
          productSku: { type: "string" },
          productCategory: { $ref: "#/components/schemas/ProductCategory" },
          productUnit: { $ref: "#/components/schemas/ProductUnit" },
          quantity: { type: "string", example: "2.000" },
          unitPrice: { type: "string", example: "150.00" },
          lineSubtotal: { type: "string", example: "300.00" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Order: {
        type: "object",
        properties: {
          id: { type: "string" },
          reference: { type: "string", example: "MD-ORD-20260915-00001" },
          status: { $ref: "#/components/schemas/OrderStatus" },
          paymentStatus: { $ref: "#/components/schemas/OrderPaymentStatus" },
          subtotal: { type: "string", example: "300.00" },
          confirmedAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          confirmedById: { type: "string", nullable: true },
          fulfilledAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          fulfilledById: { type: "string", nullable: true },
          cancelledAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          cancelledById: { type: "string", nullable: true },
          cancelReason: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/OrderItem" },
          },
        },
      },
      OrderInput: {
        type: "object",
        required: ["items"],
        description:
          "Customer cart-like input. Prices, totals, references, and customer IDs are ignored; the backend calculates them from persisted products and the authenticated CUSTOMER user.",
        properties: {
          items: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["productId", "quantity"],
              properties: {
                productId: { type: "string" },
                quantity: {
                  type: "integer",
                  minimum: 1,
                  description:
                    "Positive whole-unit quantity requested by the customer.",
                },
              },
            },
          },
        },
      },
      CancelOrderInput: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            minLength: 1,
            maxLength: 500,
            description: "Optional customer cancellation reason.",
          },
        },
      },
      SaleStatus: {
        type: "string",
        enum: ["COMPLETED", "VOIDED", "REFUNDED"],
      },
      SaleItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          saleId: { type: "string" },
          productId: { type: "string" },
          productName: { type: "string" },
          productUnit: { $ref: "#/components/schemas/ProductUnit" },
          quantity: { type: "string", example: "2.000" },
          unitPrice: { type: "string", example: "150.00" },
          unitCost: { type: "string", example: "100.00" },
          lineTotal: { type: "string", example: "300.00" },
          lineCost: { type: "string", example: "200.00" },
          grossProfit: { type: "string", example: "100.00" },
        },
      },
      Sale: {
        type: "object",
        properties: {
          id: { type: "string" },
          reference: { type: "string", example: "MD-20260915-00001" },
          sellerId: { type: "string" },
          customerId: { type: "string", nullable: true },
          status: { $ref: "#/components/schemas/SaleStatus" },
          paymentMethod: { $ref: "#/components/schemas/PaymentMethod" },
          paymentStatus: { $ref: "#/components/schemas/PaymentStatus" },
          paymentReference: { type: "string", nullable: true },
          subtotal: { type: "string", example: "300.00" },
          discountAmount: { type: "string", example: "0.00" },
          totalAmount: { type: "string", example: "300.00" },
          totalCost: { type: "string", example: "200.00" },
          grossProfit: { type: "string", example: "100.00" },
          voidedAt: { type: "string", format: "date-time", nullable: true },
          voidedById: { type: "string", nullable: true },
          voidReason: { type: "string", nullable: true },
          soldAt: { type: "string", format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/SaleItem" },
          },
        },
      },
      SaleInput: {
        type: "object",
        required: ["paymentMethod", "items"],
        properties: {
          customerId: { type: "string" },
          paymentMethod: { $ref: "#/components/schemas/PaymentMethod" },
          paymentStatus: {
            $ref: "#/components/schemas/PaymentStatus",
            default: "PAID",
          },
          paymentReference: { type: "string", maxLength: 120 },
          discountAmount: { type: "number", minimum: 0, multipleOf: 0.01 },
          soldAt: { type: "string", format: "date-time" },
          items: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["productId", "quantity"],
              properties: {
                productId: { type: "string" },
                quantity: { type: "number", exclusiveMinimum: 0 },
              },
            },
          },
        },
      },
      VoidSaleInput: {
        type: "object",
        required: ["reason"],
        properties: {
          reason: {
            type: "string",
            minLength: 1,
            maxLength: 500,
            description: "Required business reason for voiding the sale.",
          },
        },
      },
      ReportDateRange: {
        type: "object",
        properties: {
          start: { type: "string", format: "date-time" },
          end: {
            type: "string",
            format: "date-time",
            description: "Exclusive upper bound.",
          },
        },
      },
      SalesSummaryReport: {
        type: "object",
        properties: {
          period: { type: "string", example: "today" },
          range: { $ref: "#/components/schemas/ReportDateRange" },
          salesCount: { type: "integer", example: 3 },
          unitsSold: { type: "string", example: "12.000" },
          revenue: { type: "string", example: "1200.00" },
          cogs: { type: "string", example: "800.00" },
          grossProfit: {
            type: "string",
            example: "400.00",
            description:
              "Sales-based gross profit only: revenue minus cost of goods sold.",
          },
          discounts: { type: "string", example: "50.00" },
          averageSaleValue: { type: "string", example: "400.00" },
        },
      },
      ProductSalesReportItem: {
        type: "object",
        properties: {
          productId: { type: "string" },
          productName: {
            type: "string",
            description: "Historical sale item product-name snapshot.",
          },
          unit: { $ref: "#/components/schemas/ProductUnit" },
          quantitySold: { type: "string", example: "12.000" },
          revenue: { type: "string", example: "1200.00" },
          cogs: { type: "string", example: "800.00" },
          grossProfit: { type: "string", example: "400.00" },
        },
      },
      BestSellerReportItem: {
        allOf: [
          { $ref: "#/components/schemas/ProductSalesReportItem" },
          {
            type: "object",
            properties: {
              rank: { type: "integer", example: 1 },
            },
          },
        ],
      },
      StockStatus: {
        type: "string",
        enum: ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"],
      },
      LowStockReportItem: {
        type: "object",
        properties: {
          productId: { type: "string" },
          name: { type: "string" },
          sku: { type: "string" },
          category: { $ref: "#/components/schemas/ProductCategory" },
          unit: { $ref: "#/components/schemas/ProductUnit" },
          currentStock: { type: "string", example: "2.000" },
          reorderLevel: { type: "string", example: "5.000" },
          stockStatus: { $ref: "#/components/schemas/StockStatus" },
        },
      },
      InventorySummaryReport: {
        type: "object",
        properties: {
          totalActiveProducts: { type: "integer", example: 12 },
          lowStockProductCount: { type: "integer", example: 2 },
          outOfStockProductCount: { type: "integer", example: 1 },
          stockByUnit: {
            type: "array",
            description:
              "Current stock aggregated separately by unit to avoid mixing packs, liters, and cups.",
            items: {
              type: "object",
              properties: {
                unit: { $ref: "#/components/schemas/ProductUnit" },
                productCount: { type: "integer", example: 4 },
                currentStock: { type: "string", example: "25.000" },
              },
            },
          },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Check API health",
        responses: {
          "200": {
            description: "API is healthy",
          },
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a customer account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "name", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  name: { type: "string" },
                  password: { type: "string", minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Customer registered" },
          "409": { description: "Email already exists" },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in, receive an access token, and set the refresh cookie",
        description:
          "Returns the access token in JSON and sets the refresh token as an HttpOnly cookie. Browser clients must not store refresh tokens in JavaScript-accessible storage.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Authenticated" },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        security: [{ refreshCookie: [] }],
        summary:
          "Rotate the HttpOnly refresh cookie and issue a new access token",
        description:
          "Reads the refresh token from the HttpOnly cookie. A JSON refreshToken body is not accepted for browser authentication.",
        responses: {
          "200": { description: "Token refreshed" },
          "401": { description: "Invalid refresh token" },
          "403": { description: "Untrusted cookie request origin" },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        security: [{ refreshCookie: [] }],
        summary: "Revoke the refresh token and clear the refresh cookie",
        description:
          "Revokes the refresh token from the HttpOnly cookie when present, clears the cookie, and returns 204. Safe to call when no refresh cookie is present.",
        responses: {
          "204": { description: "Logged out" },
          "403": { description: "Untrusted cookie request origin" },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        security: [{ bearerAuth: [] }],
        summary: "Return the current authenticated user",
        responses: {
          "200": { description: "Current user returned" },
          "401": { description: "Access token required" },
        },
      },
    },
    "/auth/users": {
      post: {
        tags: ["Auth"],
        security: [{ bearerAuth: [] }],
        summary: "Create an internal user. Admin only.",
        responses: {
          "201": { description: "User created" },
          "403": { description: "Admin role required" },
        },
      },
    },
    "/products": {
      get: {
        tags: ["Products"],
        security: [{ bearerAuth: [] }],
        summary: "List products",
        description:
          "Internal users require read:products permission and receive product-management records. CUSTOMER users receive active customer-safe catalog records only.",
        parameters: [
          {
            name: "category",
            in: "query",
            schema: { $ref: "#/components/schemas/ProductCategory" },
          },
          {
            name: "unit",
            in: "query",
            schema: { $ref: "#/components/schemas/ProductUnit" },
          },
          {
            name: "active",
            in: "query",
            schema: { type: "boolean" },
          },
          {
            name: "search",
            in: "query",
            schema: { type: "string", minLength: 1, maxLength: 120 },
          },
        ],
        responses: {
          "200": {
            description: "Products returned",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: {
                        oneOf: [
                          { $ref: "#/components/schemas/Product" },
                          {
                            $ref: "#/components/schemas/CustomerCatalogProduct",
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid filter",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
        },
      },
      post: {
        tags: ["Products"],
        security: [{ bearerAuth: [] }],
        summary: "Create a product",
        description:
          "Requires manage:products permission. ADMIN and MANAGER may create products; STAFF and CUSTOMER may not.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ProductInput" },
            },
          },
        },
        responses: {
          "201": { description: "Product created" },
          "400": {
            description:
              "Validation error or invalid category/unit combination",
          },
          "401": { description: "Authentication required" },
          "403": { description: "Manager or admin role required" },
          "409": { description: "SKU already exists" },
        },
      },
    },
    "/products/{id}": {
      get: {
        tags: ["Products"],
        security: [{ bearerAuth: [] }],
        summary: "Get a product by id",
        description:
          "Requires read:products permission. Customers cannot access this internal product-management API.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Product returned" },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
          "404": { description: "Product not found" },
        },
      },
      patch: {
        tags: ["Products"],
        security: [{ bearerAuth: [] }],
        summary: "Update product details",
        description:
          "Requires manage:products permission. ADMIN and MANAGER may update products; STAFF and CUSTOMER may not.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ProductUpdateInput" },
            },
          },
        },
        responses: {
          "200": { description: "Product updated" },
          "400": {
            description:
              "Validation error or invalid category/unit combination",
          },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
          "404": { description: "Product not found" },
          "409": { description: "SKU already exists" },
        },
      },
    },
    "/products/{id}/deactivate": {
      patch: {
        tags: ["Products"],
        security: [{ bearerAuth: [] }],
        summary: "Deactivate a product",
        description:
          "Requires manage:products permission. Deactivation preserves historical references and prevents later sales slices from treating the product as available.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Product deactivated" },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
          "404": { description: "Product not found" },
        },
      },
    },
    "/inventory": {
      get: {
        tags: ["Inventory"],
        security: [{ bearerAuth: [] }],
        summary: "List current inventory balances",
        description:
          "Requires read:inventory permission. Returns Product.currentStock as the maintained current balance with low-stock status.",
        parameters: [
          {
            name: "active",
            in: "query",
            schema: { type: "boolean" },
          },
          {
            name: "lowStock",
            in: "query",
            schema: { type: "boolean" },
          },
        ],
        responses: {
          "200": {
            description: "Inventory returned",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/InventoryItem" },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
        },
      },
    },
    "/inventory/low-stock": {
      get: {
        tags: ["Inventory"],
        security: [{ bearerAuth: [] }],
        summary: "List low-stock products",
        description:
          "Requires read:inventory permission. Low stock means currentStock is less than or equal to reorderLevel.",
        responses: {
          "200": { description: "Low-stock products returned" },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
        },
      },
    },
    "/inventory/products/{productId}": {
      get: {
        tags: ["Inventory"],
        security: [{ bearerAuth: [] }],
        summary: "Get current stock by product",
        description:
          "Requires read:inventory permission. Customers cannot access internal inventory APIs.",
        parameters: [
          {
            name: "productId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Current stock returned" },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
          "404": { description: "Product not found" },
        },
      },
    },
    "/inventory/movements": {
      get: {
        tags: ["Inventory"],
        security: [{ bearerAuth: [] }],
        summary: "List stock movement history",
        description:
          "Requires read:inventory permission. Supports product, type, and date range filtering.",
        parameters: [
          {
            name: "productId",
            in: "query",
            schema: { type: "string" },
          },
          {
            name: "type",
            in: "query",
            schema: { $ref: "#/components/schemas/StockMovementType" },
          },
          {
            name: "from",
            in: "query",
            schema: { type: "string", format: "date-time" },
          },
          {
            name: "to",
            in: "query",
            schema: { type: "string", format: "date-time" },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 25 },
          },
        ],
        responses: {
          "200": {
            description: "Movements returned",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/StockMovement" },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Invalid filter" },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
        },
      },
    },
    "/inventory/receive": {
      post: {
        tags: ["Inventory"],
        security: [{ bearerAuth: [] }],
        summary: "Receive stock and create an audit movement",
        description:
          "Requires manage:inventory permission. Updates Product.currentStock and creates a RECEIVED stock movement transactionally.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/StockReceiptInput" },
            },
          },
        },
        responses: {
          "201": { description: "Stock received" },
          "400": { description: "Validation error or unit mismatch" },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
          "404": { description: "Product not found" },
        },
      },
    },
    "/inventory/adjust": {
      post: {
        tags: ["Inventory"],
        security: [{ bearerAuth: [] }],
        summary: "Apply a stock adjustment delta",
        description:
          "Requires manage:inventory permission. Uses quantityChange rather than arbitrary balance overwrite and creates an ADJUSTMENT movement.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/StockAdjustmentInput" },
            },
          },
        },
        responses: {
          "201": { description: "Stock adjusted" },
          "400": { description: "Validation error or unit mismatch" },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
          "404": { description: "Product not found" },
          "409": { description: "Adjustment would make stock negative" },
        },
      },
    },
    "/inventory/returns": {
      post: {
        tags: ["Inventory"],
        security: [{ bearerAuth: [] }],
        summary: "Return stock to inventory and create an audit movement",
        description:
          "Requires manage:inventory permission. This records returned stock only; refund/payment processing belongs to sales returns.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/StockReturnInput" },
            },
          },
        },
        responses: {
          "201": { description: "Stock returned" },
          "400": { description: "Validation error or unit mismatch" },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
          "404": { description: "Product not found" },
        },
      },
    },
    "/inventory/damage": {
      post: {
        tags: ["Inventory"],
        security: [{ bearerAuth: [] }],
        summary: "Record damaged stock",
        description:
          "Requires manage:inventory permission. Decrements stock and creates a DAMAGE movement with a required reason.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/StockDamageInput" },
            },
          },
        },
        responses: {
          "201": { description: "Damaged stock recorded" },
          "400": { description: "Validation error or unit mismatch" },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
          "404": { description: "Product not found" },
          "409": { description: "Damage quantity would make stock negative" },
        },
      },
    },
    "/orders": {
      get: {
        tags: ["Orders"],
        security: [{ bearerAuth: [] }],
        summary: "List customer orders",
        description:
          "CUSTOMER users receive only their own orders. ADMIN and MANAGER may read customer orders through read:orders. STAFF has no broad order visibility.",
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { $ref: "#/components/schemas/OrderStatus" },
          },
          {
            name: "paymentStatus",
            in: "query",
            schema: { $ref: "#/components/schemas/OrderPaymentStatus" },
          },
          {
            name: "customerId",
            in: "query",
            description:
              "Management filter. CUSTOMER users are always scoped to their own orders.",
            schema: { type: "string" },
          },
          {
            name: "from",
            in: "query",
            schema: { type: "string", format: "date-time" },
          },
          {
            name: "to",
            in: "query",
            schema: { type: "string", format: "date-time" },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 25 },
          },
        ],
        responses: {
          "200": {
            description: "Orders returned",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Order" },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Invalid filter" },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
        },
      },
      post: {
        tags: ["Orders"],
        security: [{ bearerAuth: [] }],
        summary: "Create a customer order",
        description:
          "CUSTOMER only. Creates an order from product IDs and quantities. The backend revalidates active products, checks current availability, calculates price snapshots/subtotals, and does not reserve or decrement inventory in this foundation slice.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/OrderInput" },
            },
          },
        },
        responses: {
          "201": {
            description: "Order created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: { $ref: "#/components/schemas/Order" },
                  },
                },
              },
            },
          },
          "400": { description: "Validation error" },
          "401": { description: "Authentication required" },
          "403": { description: "Only CUSTOMER users can create orders" },
          "404": { description: "Product not found" },
          "409": {
            description:
              "Product inactive or currently unavailable in the requested quantity",
          },
        },
      },
    },
    "/orders/{id}": {
      get: {
        tags: ["Orders"],
        security: [{ bearerAuth: [] }],
        summary: "Get an order by id",
        description:
          "CUSTOMER users can only read their own orders. ADMIN and MANAGER may read orders through read:orders. Returned items use historical snapshots.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Order returned",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: { $ref: "#/components/schemas/Order" },
                  },
                },
              },
            },
          },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
          "404": { description: "Order not found" },
        },
      },
    },
    "/orders/{id}/cancel": {
      post: {
        tags: ["Orders"],
        security: [{ bearerAuth: [] }],
        summary: "Cancel a customer order",
        description:
          "Customers may cancel only their own PENDING or CONFIRMED orders. ADMIN and MANAGER may cancel customer orders through manage:orders. Inventory is not restored because customer orders do not reserve or decrement inventory in this slice.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CancelOrderInput" },
            },
          },
        },
        responses: {
          "200": {
            description: "Order cancelled",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: { $ref: "#/components/schemas/Order" },
                  },
                },
              },
            },
          },
          "400": { description: "Validation error" },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
          "404": { description: "Order not found" },
          "409": {
            description:
              "Order already cancelled or cannot be cancelled from its current state",
          },
        },
      },
    },
    "/orders/{id}/confirm": {
      post: {
        tags: ["Orders"],
        security: [{ bearerAuth: [] }],
        summary: "Confirm a customer order",
        description:
          "Requires manage:orders. Transitions PENDING orders to CONFIRMED. Does not mark the order paid, reserve inventory, decrement stock, create stock movements, or create a Sale.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Order confirmed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: { $ref: "#/components/schemas/Order" },
                  },
                },
              },
            },
          },
          "400": { description: "Validation error" },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
          "404": { description: "Order not found" },
          "409": { description: "Order cannot be confirmed from its state" },
        },
      },
    },
    "/orders/{id}/fulfill": {
      post: {
        tags: ["Orders"],
        security: [{ bearerAuth: [] }],
        summary: "Fulfill a customer order",
        description:
          "Requires manage:orders. Transitions CONFIRMED orders to FULFILLED. Does not process payments, reserve inventory, decrement stock, create stock movements, or create a Sale.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Order fulfilled",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: { $ref: "#/components/schemas/Order" },
                  },
                },
              },
            },
          },
          "400": { description: "Validation error" },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
          "404": { description: "Order not found" },
          "409": { description: "Order cannot be fulfilled from its state" },
        },
      },
    },
    "/sales": {
      get: {
        tags: ["Sales"],
        security: [{ bearerAuth: [] }],
        summary: "List sales",
        description:
          "Requires read:sales permission. Supports basic operational filters; analytics are handled by reporting endpoints.",
        parameters: [
          { name: "sellerId", in: "query", schema: { type: "string" } },
          { name: "customerId", in: "query", schema: { type: "string" } },
          {
            name: "status",
            in: "query",
            schema: { $ref: "#/components/schemas/SaleStatus" },
          },
          {
            name: "paymentStatus",
            in: "query",
            schema: { $ref: "#/components/schemas/PaymentStatus" },
          },
          {
            name: "from",
            in: "query",
            schema: { type: "string", format: "date-time" },
          },
          {
            name: "to",
            in: "query",
            schema: { type: "string", format: "date-time" },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 25 },
          },
        ],
        responses: {
          "200": {
            description: "Sales returned",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Sale" },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Invalid filter" },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
        },
      },
      post: {
        tags: ["Sales"],
        security: [{ bearerAuth: [] }],
        summary: "Record a completed POS sale",
        description:
          "Requires create:sales permission. Prices are loaded from the database; clients submit product IDs and quantities. Creates SaleItems and SOLD stock movements transactionally.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SaleInput" },
            },
          },
        },
        responses: {
          "201": {
            description: "Sale recorded",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: { $ref: "#/components/schemas/Sale" },
                  },
                },
              },
            },
          },
          "400": { description: "Validation error or invalid discount" },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
          "404": { description: "Product or customer not found" },
          "409": { description: "Insufficient stock" },
        },
      },
    },
    "/sales/{id}": {
      get: {
        tags: ["Sales"],
        security: [{ bearerAuth: [] }],
        summary: "Get a sale by id",
        description:
          "Requires read:sales permission. Returned items include historical product snapshots.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Sale returned",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: { $ref: "#/components/schemas/Sale" },
                  },
                },
              },
            },
          },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
          "404": { description: "Sale not found" },
        },
      },
    },
    "/sales/{id}/void": {
      post: {
        tags: ["Sales"],
        security: [{ bearerAuth: [] }],
        summary: "Void a completed sale",
        description:
          "Requires void:sales permission. Voids an eligible completed sale transactionally, restores inventory through RETURN stock movements, and records void audit metadata. This does not process external payment-provider refunds.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/VoidSaleInput" },
            },
          },
        },
        responses: {
          "200": {
            description: "Sale voided",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: { $ref: "#/components/schemas/Sale" },
                  },
                },
              },
            },
          },
          "400": { description: "Validation error" },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
          "404": { description: "Sale not found" },
          "409": {
            description: "Sale is already voided or cannot be voided",
          },
        },
      },
    },
    "/reports/summary": {
      get: {
        tags: ["Reports"],
        security: [{ bearerAuth: [] }],
        summary: "Get sales, cost, and gross profit summary by period",
        description:
          "Requires read:reports permission. Uses the configured business timezone for period boundaries. Only COMPLETED sales contribute to financial totals.",
        parameters: [
          {
            name: "period",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["today", "week", "month", "year"],
            },
          },
        ],
        responses: {
          "200": {
            description: "Summary returned",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: { $ref: "#/components/schemas/SalesSummaryReport" },
                  },
                },
              },
            },
          },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
        },
      },
    },
    "/reports/today": {
      get: {
        tags: ["Reports"],
        security: [{ bearerAuth: [] }],
        summary: "Get today's sales summary",
        description:
          "Requires read:reports permission. Today is calculated in the business timezone.",
        responses: {
          "200": {
            description: "Summary returned",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: { $ref: "#/components/schemas/SalesSummaryReport" },
                  },
                },
              },
            },
          },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
        },
      },
    },
    "/reports/week": {
      get: {
        tags: ["Reports"],
        security: [{ bearerAuth: [] }],
        summary: "Get this week's sales summary",
        description:
          "Requires read:reports permission. Weeks start on Monday in the business timezone.",
        responses: {
          "200": { description: "Summary returned" },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
        },
      },
    },
    "/reports/month": {
      get: {
        tags: ["Reports"],
        security: [{ bearerAuth: [] }],
        summary: "Get this month's sales summary",
        description:
          "Requires read:reports permission. Month boundaries use the business timezone.",
        responses: {
          "200": { description: "Summary returned" },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
        },
      },
    },
    "/reports/year": {
      get: {
        tags: ["Reports"],
        security: [{ bearerAuth: [] }],
        summary: "Get this year's sales summary",
        description:
          "Requires read:reports permission. Year boundaries use the business timezone.",
        responses: {
          "200": { description: "Summary returned" },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
        },
      },
    },
    "/reports/sales": {
      get: {
        tags: ["Reports"],
        security: [{ bearerAuth: [] }],
        summary: "Get a custom date-range sales summary",
        description:
          "Requires read:reports permission. Date-only from/to values are interpreted in the business timezone. Gross profit is sales-based gross profit, not full accounting profit.",
        parameters: [
          {
            name: "from",
            in: "query",
            schema: { type: "string", example: "2026-09-15" },
          },
          {
            name: "to",
            in: "query",
            schema: { type: "string", example: "2026-09-15" },
          },
          { name: "sellerId", in: "query", schema: { type: "string" } },
          {
            name: "status",
            in: "query",
            schema: { $ref: "#/components/schemas/SaleStatus" },
          },
        ],
        responses: {
          "200": {
            description: "Summary returned",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: { $ref: "#/components/schemas/SalesSummaryReport" },
                  },
                },
              },
            },
          },
          "400": { description: "Invalid report filters" },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
        },
      },
    },
    "/reports/products": {
      get: {
        tags: ["Reports"],
        security: [{ bearerAuth: [] }],
        summary: "Get product sales for a date range",
        description:
          "Requires read:reports permission. Uses SaleItem historical snapshots for product name, unit, revenue, COGS, and gross profit.",
        parameters: [
          {
            name: "from",
            in: "query",
            schema: { type: "string", example: "2026-09-01" },
          },
          {
            name: "to",
            in: "query",
            schema: { type: "string", example: "2026-09-30" },
          },
          { name: "productId", in: "query", schema: { type: "string" } },
          {
            name: "category",
            in: "query",
            schema: { $ref: "#/components/schemas/ProductCategory" },
          },
          {
            name: "unit",
            in: "query",
            schema: { $ref: "#/components/schemas/ProductUnit" },
          },
          { name: "sellerId", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Product sales returned",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        range: { $ref: "#/components/schemas/ReportDateRange" },
                        products: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/ProductSalesReportItem",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Invalid report filters" },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
        },
      },
    },
    "/reports/best-sellers": {
      get: {
        tags: ["Reports"],
        security: [{ bearerAuth: [] }],
        summary: "Get best-selling products",
        description:
          "Requires read:reports permission. Products are ranked by quantity sold by default.",
        parameters: [
          {
            name: "from",
            in: "query",
            schema: { type: "string", example: "2026-09-01" },
          },
          {
            name: "to",
            in: "query",
            schema: { type: "string", example: "2026-09-30" },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 25 },
          },
        ],
        responses: {
          "200": {
            description: "Best sellers returned",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        rankingMetric: {
                          type: "string",
                          example: "quantitySold",
                        },
                        products: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/BestSellerReportItem",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Invalid report filters" },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
        },
      },
    },
    "/reports/low-stock": {
      get: {
        tags: ["Reports"],
        security: [{ bearerAuth: [] }],
        summary: "Get low-stock and out-of-stock products",
        description:
          "Requires read:reports permission. LOW_STOCK means current stock is above zero and at or below reorder level.",
        responses: {
          "200": {
            description: "Low-stock products returned",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/LowStockReportItem",
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
        },
      },
    },
    "/reports/inventory": {
      get: {
        tags: ["Reports"],
        security: [{ bearerAuth: [] }],
        summary: "Get inventory summary",
        description:
          "Requires read:reports permission. Stock quantities are grouped by unit so packs, liters, and cups are not mixed into one total.",
        responses: {
          "200": {
            description: "Inventory summary returned",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      $ref: "#/components/schemas/InventorySummaryReport",
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Authentication required" },
          "403": { description: "Insufficient permission" },
        },
      },
    },
    "/reports/dashboard": {
      get: {
        tags: ["Reports"],
        security: [{ bearerAuth: [] }],
        summary: "Get administrator dashboard metrics. Admin only.",
        responses: { "200": { description: "Dashboard returned" } },
      },
    },
  },
};
