import type { AppRoute } from "../routing/routes";
import { EmptyState } from "../components/Feedback";

const pageCopy: Record<
  string,
  { title: string; body: string; actions: string[] }
> = {
  "/admin": {
    title: "Admin foundation ready",
    body: "This area will become the administrator overview for sales, stock, products, users, and reports.",
    actions: ["Review shop activity", "Manage users", "Open reports"],
  },
  "/products": {
    title: "Product workspace ready",
    body: "The product catalog UI will build on the existing backend product APIs.",
    actions: ["List products", "Add products", "Deactivate products"],
  },
  "/inventory": {
    title: "Inventory workspace ready",
    body: "Stock receiving, adjustments, returns, damage, and movement history will plug into this area.",
    actions: ["View stock", "Receive stock", "Review movements"],
  },
  "/sales": {
    title: "Sales workspace ready",
    body: "The POS interface will use the authenticated sales foundation and inventory safeguards.",
    actions: ["Create sale", "Search sales", "Check stock"],
  },
  "/reports": {
    title: "Reports workspace ready",
    body: "The reporting UI will consume the backend reporting foundation without recalculating financials in the browser.",
    actions: ["Today", "This week", "Best sellers"],
  },
  "/customer": {
    title: "Customer area ready",
    body: "Customer-facing features will stay separate from internal shop operations.",
    actions: ["Account", "Orders", "Support"],
  },
};

export function FoundationPage({ route }: { route: AppRoute }) {
  const copy = pageCopy[route.path] ?? {
    title: route.title,
    body: route.description,
    actions: [],
  };

  return (
    <div className="page-grid">
      <section className="page-intro" aria-labelledby="page-intro-title">
        <p className="eyebrow">Foundation</p>
        <h2 id="page-intro-title">{copy.title}</h2>
        <p>{copy.body}</p>
      </section>

      <EmptyState title="Next workflow">
        <ul className="action-list">
          {copy.actions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
      </EmptyState>
    </div>
  );
}
