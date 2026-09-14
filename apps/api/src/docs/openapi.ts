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
        enum: ["DRINK", "NOODLES", "VEGETABLE_OIL", "SUGAR"],
      },
      ProductUnit: {
        type: "string",
        enum: ["PACK", "LITER", "CUP"],
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
        responses: { "200": { description: "Products returned" } },
      },
      post: {
        tags: ["Products"],
        security: [{ bearerAuth: [] }],
        summary: "Create a product with category-derived units",
        responses: {
          "201": { description: "Product created" },
          "403": { description: "Manager or admin role required" },
        },
      },
    },
    "/products/{id}": {
      patch: {
        tags: ["Products"],
        security: [{ bearerAuth: [] }],
        summary: "Update product details",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Product updated" },
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
