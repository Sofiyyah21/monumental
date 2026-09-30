import { useState, type FormEvent } from "react";
import { apiClient, ApiError } from "../api/client";
import { Alert } from "../components/Feedback";
import { Logo } from "../components/Logo";
import { navigate } from "../routing/useBrowserRoute";
import {
  validateSignUpForm,
  type SignUpFieldErrors,
  type SignUpFormValues,
} from "./signup-validation";

const emptyValues: SignUpFormValues = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

export function SignUpPage({ onRegistered }: { onRegistered(): void }) {
  const [values, setValues] = useState<SignUpFormValues>(emptyValues);
  const [fieldErrors, setFieldErrors] = useState<SignUpFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const nextErrors = validateSignUpForm(values);
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.registerCustomer({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
      });
      setValues(emptyValues);
      onRegistered();
    } catch (error) {
      setValues((currentValues) => ({
        ...currentValues,
        password: "",
        confirmPassword: "",
      }));
      setSubmitError(toRegistrationErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SignUpView
      fieldErrors={fieldErrors}
      onFieldChange={(field, value) => {
        setValues((currentValues) => ({ ...currentValues, [field]: value }));
        setFieldErrors((currentErrors) => {
          if (!currentErrors[field]) {
            return currentErrors;
          }
          const remainingErrors = { ...currentErrors };
          delete remainingErrors[field];
          return remainingErrors;
        });
      }}
      onSubmit={submit}
      submitError={submitError}
      submitting={submitting}
      values={values}
    />
  );
}

export function SignUpView({
  fieldErrors,
  onFieldChange,
  onSubmit,
  submitError,
  submitting,
  values,
}: {
  fieldErrors: SignUpFieldErrors;
  onFieldChange(field: keyof SignUpFormValues, value: string): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  submitError: string | null;
  submitting: boolean;
  values: SignUpFormValues;
}) {
  return (
    <main className="login-screen">
      <section className="login-panel" aria-labelledby="signup-title">
        <Logo />
        <div className="login-heading">
          <p className="eyebrow">Customer account</p>
          <h1 id="signup-title">Create your Monumental Details account</h1>
          <p>Sign up to shop, review your cart, and track your orders.</p>
        </div>

        {submitError ? (
          <Alert title="Account could not be created">{submitError}</Alert>
        ) : null}

        <form className="form-stack" onSubmit={onSubmit} noValidate>
          <label>
            <span>Full name</span>
            <input
              aria-describedby={
                fieldErrors.name ? "signup-name-error" : undefined
              }
              aria-invalid={fieldErrors.name ? "true" : undefined}
              autoComplete="name"
              name="name"
              onChange={(event) => onFieldChange("name", event.target.value)}
              required
              type="text"
              value={values.name}
            />
            {fieldErrors.name ? (
              <span className="field-error" id="signup-name-error" role="alert">
                {fieldErrors.name}
              </span>
            ) : null}
          </label>

          <label>
            <span>Email address</span>
            <input
              aria-describedby={
                fieldErrors.email ? "signup-email-error" : undefined
              }
              aria-invalid={fieldErrors.email ? "true" : undefined}
              autoComplete="email"
              inputMode="email"
              name="email"
              onChange={(event) => onFieldChange("email", event.target.value)}
              required
              type="email"
              value={values.email}
            />
            {fieldErrors.email ? (
              <span
                className="field-error"
                id="signup-email-error"
                role="alert"
              >
                {fieldErrors.email}
              </span>
            ) : null}
          </label>

          <label>
            <span>Password</span>
            <input
              aria-describedby={
                fieldErrors.password ? "signup-password-error" : undefined
              }
              aria-invalid={fieldErrors.password ? "true" : undefined}
              autoComplete="new-password"
              name="password"
              onChange={(event) =>
                onFieldChange("password", event.target.value)
              }
              required
              type="password"
              value={values.password}
            />
            {fieldErrors.password ? (
              <span
                className="field-error"
                id="signup-password-error"
                role="alert"
              >
                {fieldErrors.password}
              </span>
            ) : null}
          </label>

          <label>
            <span>Confirm password</span>
            <input
              aria-describedby={
                fieldErrors.confirmPassword
                  ? "signup-confirm-password-error"
                  : undefined
              }
              aria-invalid={fieldErrors.confirmPassword ? "true" : undefined}
              autoComplete="new-password"
              name="confirmPassword"
              onChange={(event) =>
                onFieldChange("confirmPassword", event.target.value)
              }
              required
              type="password"
              value={values.confirmPassword}
            />
            {fieldErrors.confirmPassword ? (
              <span
                className="field-error"
                id="signup-confirm-password-error"
                role="alert"
              >
                {fieldErrors.confirmPassword}
              </span>
            ) : null}
          </label>

          <button
            className="button button--primary"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Creating account" : "Create Account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <a
            className="inline-link"
            href="/login"
            onClick={(event) => {
              event.preventDefault();
              navigate("/login");
            }}
          >
            Sign in
          </a>
        </p>
      </section>
    </main>
  );
}

function toRegistrationErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 409 || error.code === "USER_EXISTS") {
      return "An account with this email already exists. Please sign in instead.";
    }
    if (error.status === 400) {
      return "Please check your account details and try again.";
    }
    if (error.status === 0) {
      return "The network is unavailable. Check your connection and try again.";
    }
  }

  return "The account service is unavailable right now. Please try again.";
}
