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
      UserRole: {
        type: "string",
        enum: ["ADMIN", "MANAGER", "STAFF", "CUSTOMER"],
      },
      PaymentMethod: {
        type: "string",
        enum: ["CASH", "TRANSFER", "CARD", "OTHER"],
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
    "/inventory/movements": {
      get: {
        tags: ["Inventory"],
        security: [{ bearerAuth: [] }],
        summary: "List stock movement history",
        responses: { "200": { description: "Movements returned" } },
      },
    },
    "/inventory/receive": {
      post: {
        tags: ["Inventory"],
        security: [{ bearerAuth: [] }],
        summary: "Receive stock and create an audit movement",
        responses: { "201": { description: "Stock received" } },
      },
    },
    "/inventory/adjust": {
      post: {
        tags: ["Inventory"],
        security: [{ bearerAuth: [] }],
        summary:
          "Adjust stock to a counted quantity and create an audit movement",
        responses: { "201": { description: "Stock adjusted" } },
      },
    },
    "/inventory/returns": {
      post: {
        tags: ["Inventory"],
        security: [{ bearerAuth: [] }],
        summary: "Return stock to inventory and create an audit movement",
        responses: { "201": { description: "Stock returned" } },
      },
    },
    "/sales": {
      get: {
        tags: ["Sales"],
        security: [{ bearerAuth: [] }],
        summary: "List recent sales",
        responses: { "200": { description: "Sales returned" } },
      },
      post: {
        tags: ["Sales"],
        security: [{ bearerAuth: [] }],
        summary:
          "Record a sale, calculate financials, and decrement inventory transactionally",
        responses: {
          "201": { description: "Sale recorded" },
          "409": { description: "Insufficient stock" },
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
