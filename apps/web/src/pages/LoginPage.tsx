import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/useAuth";
import { Alert } from "../components/Feedback";
import { Logo } from "../components/Logo";
import { navigate } from "../routing/useBrowserRoute";
import { submitLoginCredentials } from "./login-flow";
import type { CurrentUser } from "../api/types";

export function LoginPage({
  onAuthenticated,
  successMessage,
}: {
  onAuthenticated(user: CurrentUser): void;
  successMessage?: string | null;
}) {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    await submitLoginCredentials({
      email,
      password,
      login: auth.login,
      onAuthenticated,
      onFailure: setSubmitError,
    });
  }

  return (
    <LoginView
      email={email}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={submit}
      password={password}
      submitError={submitError}
      submitting={auth.status === "loading"}
      successMessage={successMessage ?? null}
    />
  );
}

export function LoginView({
  email,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  password,
  submitError,
  submitting,
  successMessage,
}: {
  email: string;
  onEmailChange(value: string): void;
  onPasswordChange(value: string): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  password: string;
  submitError: string | null;
  submitting: boolean;
  successMessage: string | null;
}) {
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

        {successMessage ? (
          <Alert title="Account created" variant="info">
            {successMessage}
          </Alert>
        ) : null}

        <form className="form-stack" onSubmit={onSubmit}>
          <label>
            <span>Email address</span>
            <input
              autoComplete="email"
              inputMode="email"
              name="email"
              onChange={(event) => onEmailChange(event.target.value)}
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
              onChange={(event) => onPasswordChange(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <button
            className="button button--primary"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Signing in" : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          Don&apos;t have an account?{" "}
          <a
            className="inline-link"
            href="/signup"
            onClick={(event) => {
              event.preventDefault();
              navigate("/signup");
            }}
          >
            Sign up
          </a>
        </p>
      </section>
    </main>
  );
}
