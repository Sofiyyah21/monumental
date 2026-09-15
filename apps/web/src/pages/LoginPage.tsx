import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/useAuth";
import { Alert } from "../components/Feedback";
import { Logo } from "../components/Logo";

export function LoginPage({ onAuthenticated }: { onAuthenticated(): void }) {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    try {
      await auth.login(email, password);
      onAuthenticated();
    } catch {
      setSubmitError("Check your email and password, then try again.");
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel" aria-labelledby="login-title">
        <Logo />
        <div className="login-heading">
          <p className="eyebrow">Shop management</p>
          <h1 id="login-title">Sign in to Monumental Details</h1>
          <p>
            Use your staff, manager, admin, or customer account to continue.
          </p>
        </div>

        {submitError ? (
          <Alert title="Unable to sign in">{submitError}</Alert>
        ) : null}

        <form className="form-stack" onSubmit={submit}>
          <label>
            <span>Email address</span>
            <input
              autoComplete="email"
              inputMode="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              autoComplete="current-password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <button
            className="button button--primary"
            disabled={auth.status === "loading"}
            type="submit"
          >
            {auth.status === "loading" ? "Signing in" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
