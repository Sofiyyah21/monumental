import { Alert } from "../components/Feedback";

export function ForbiddenPage({ onGoHome }: { onGoHome(): void }) {
  return (
    <section className="page-grid">
      <Alert title="Access restricted" variant="info">
        Your account does not have permission to open this area.
      </Alert>
      <button
        className="button button--primary fit-content"
        type="button"
        onClick={onGoHome}
      >
        Return to your workspace
      </button>
    </section>
  );
}
