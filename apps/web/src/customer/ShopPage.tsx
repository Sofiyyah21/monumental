import type {
  CustomerCatalogProduct,
  ProductCategory,
  ProductUnit,
} from "../api/types";
import { Alert, EmptyState, LoadingState } from "../components/Feedback";
import {
  formatMoney,
  productCategories,
  productCategoryLabels,
  productUnitLabels,
  productUnits,
} from "../products/product-utils";
import { type ShopProductFilters, useShopProducts } from "./useShopProducts";

const availabilityLabels = {
  AVAILABLE: "Available",
  OUT_OF_STOCK: "Out of stock",
} as const;

export function ShopPage() {
  const { error, filters, loading, products, setFilters } = useShopProducts();

  return (
    <ShopCatalogView
      error={error}
      filters={filters}
      loading={loading}
      onFilterChange={setFilters}
      products={products}
    />
  );
}

export function ShopCatalogView({
  error,
  filters,
  loading,
  onFilterChange,
  products,
}: {
  error: string | null;
  filters: ShopProductFilters;
  loading: boolean;
  onFilterChange(filters: ShopProductFilters): void;
  products: CustomerCatalogProduct[];
}) {
  return (
    <div className="shop-grid">
      <section
        className="dashboard-hero shop-hero"
        aria-labelledby="shop-title"
      >
        <div>
          <p className="eyebrow">Customer shop</p>
          <h2 id="shop-title">Monumental Details catalog</h2>
          <p>
            Browse the active drinks, noodles, vegetable oil, and sugar
            currently offered by Monumental Details.
          </p>
        </div>
        <div className="shop-note">
          <strong>Catalog only</strong>
          <span>
            Orders and checkout will be added in a later customer slice.
          </span>
        </div>
      </section>

      <section className="panel shop-filters" aria-label="Shop catalog filters">
        <label>
          <span>Search products</span>
          <input
            onChange={(event) =>
              onFilterChange({ ...filters, search: event.target.value })
            }
            placeholder="Search drinks, noodles, oil, or sugar"
            type="search"
            value={filters.search}
          />
        </label>
        <label>
          <span>Category</span>
          <select
            onChange={(event) =>
              onFilterChange({
                ...filters,
                category: event.target.value as ProductCategory | "",
              })
            }
            value={filters.category}
          >
            <option value="">All categories</option>
            {productCategories.map((category) => (
              <option key={category} value={category}>
                {productCategoryLabels[category]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Unit</span>
          <select
            onChange={(event) =>
              onFilterChange({
                ...filters,
                unit: event.target.value as ProductUnit | "",
              })
            }
            value={filters.unit}
          >
            <option value="">All units</option>
            {productUnits.map((unit) => (
              <option key={unit} value={unit}>
                {productUnitLabels[unit]}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="panel shop-catalog" aria-labelledby="catalog-heading">
        <div className="panel-heading">
          <p className="eyebrow">Products</p>
          <h3 id="catalog-heading">Available catalog</h3>
        </div>

        {loading ? (
          <LoadingState message="Loading shop catalog" />
        ) : error ? (
          <Alert title="Catalog unavailable">{error}</Alert>
        ) : products.length === 0 ? (
          <EmptyState title="No products found">
            <p>Try a different search, category, or unit filter.</p>
          </EmptyState>
        ) : (
          <ProductCatalogGrid products={products} />
        )}
      </section>
    </div>
  );
}

function ProductCatalogGrid({
  products,
}: {
  products: CustomerCatalogProduct[];
}) {
  return (
    <div className="shop-product-grid" aria-live="polite">
      {products.map((product) => (
        <article className="shop-product-card" key={product.id}>
          <div className="shop-product-main">
            <div>
              <p className="shop-product-code">Code {product.sku}</p>
              <h4>{product.name}</h4>
            </div>
            <span
              className={`status-badge ${
                product.availability === "AVAILABLE"
                  ? "status-badge--IN_STOCK"
                  : "status-badge--OUT_OF_STOCK"
              }`}
            >
              {availabilityLabels[product.availability]}
            </span>
          </div>
          <dl className="shop-product-meta">
            <div>
              <dt>Category</dt>
              <dd>{productCategoryLabels[product.category]}</dd>
            </div>
            <div>
              <dt>Unit</dt>
              <dd>{productUnitLabels[product.unit]}</dd>
            </div>
          </dl>
          <div className="shop-price-line">
            <span>Selling price</span>
            <strong>{formatMoney(product.sellingPrice)}</strong>
          </div>
        </article>
      ))}
    </div>
  );
}
