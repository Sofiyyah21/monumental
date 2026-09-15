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
        summary: "Log in and receive access and refresh tokens",
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
        summary: "Rotate a refresh token and issue a new access token",
        responses: {
          "200": { description: "Token refreshed" },
          "401": { description: "Invalid refresh token" },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Revoke a refresh token",
        responses: {
          "204": { description: "Logged out" },
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
        summary: "List products for internal shop users",
        description:
          "Requires read:products permission. Customers cannot access this internal product-management API.",
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
                      items: { $ref: "#/components/schemas/Product" },
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
    "/reports/summary": {
      get: {
        tags: ["Reports"],
        security: [{ bearerAuth: [] }],
        summary: "Get sales, cost, and gross profit summary by period",
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
        responses: { "200": { description: "Summary returned" } },
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
