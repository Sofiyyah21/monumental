import type { ReactNode } from "react";

export function LoadingState({ message = "Loading" }: { message?: string }) {
  return (
    <div className="state-block" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <section className="state-block state-block--empty">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function Alert({
  title,
  children,
  variant = "error",
}: {
  title: string;
  children?: ReactNode;
  variant?: "error" | "info";
}) {
  return (
    <div
      className={`alert alert--${variant}`}
      role={variant === "error" ? "alert" : "status"}
    >
      <strong>{title}</strong>
      {children ? <span>{children}</span> : null}
    </div>
  );
}
