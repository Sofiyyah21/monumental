import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LoginView } from "./LoginPage";
import { SignUpView } from "./SignUpPage";
import { validateSignUpForm, type SignUpFormValues } from "./signup-validation";

const validValues: SignUpFormValues = {
  name: "Ada Customer",
  email: "ada@example.com",
  password: "password123",
  confirmPassword: "password123",
};

function renderSignup(
  overrides: Partial<{
    fieldErrors: Partial<Record<keyof SignUpFormValues, string>>;
    submitting: boolean;
    submitError: string | null;
    values: SignUpFormValues;
  }> = {},
) {
  return renderToStaticMarkup(
    <SignUpView
      fieldErrors={overrides.fieldErrors ?? {}}
      onFieldChange={vi.fn()}
      onSubmit={vi.fn()}
      submitError={overrides.submitError ?? null}
      submitting={overrides.submitting ?? false}
      values={overrides.values ?? validValues}
    />,
  );
}

describe("SignUpPage", () => {
  it("renders the customer signup form and sign-in link", () => {
    const html = renderSignup();

    expect(html).toContain("Create your Monumental Details account");
    expect(html).toContain("Full name");
    expect(html).toContain("Email address");
    expect(html).toContain("Password");
    expect(html).toContain("Confirm password");
    expect(html).toContain("Create Account");
    expect(html).toContain('href="/login"');
    expect(html).toContain("Sign in");
  });

  it("renders validation and submission states accessibly", () => {
    const html = renderSignup({
      fieldErrors: {
        name: "Enter your full name.",
        email: "Enter a valid email address.",
        confirmPassword: "Passwords must match.",
      },
      submitting: true,
      submitError: "An account with this email already exists.",
    });

    expect(html).toContain("Account could not be created");
    expect(html).toContain("Enter your full name.");
    expect(html).toContain("Enter a valid email address.");
    expect(html).toContain("Passwords must match.");
    expect(html).toContain('role="alert"');
    expect(html).toContain("Creating account");
    expect(html).toContain("disabled");
  });

  it("validates required fields, email format, and password confirmation", () => {
    expect(
      validateSignUpForm({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
      }),
    ).toEqual({
      name: "Enter your full name.",
      email: "Enter your email address.",
      password: "Enter a password.",
      confirmPassword: "Confirm your password.",
    });

    expect(
      validateSignUpForm({
        ...validValues,
        email: "not-an-email",
      }).email,
    ).toBe("Enter a valid email address.");

    expect(
      validateSignUpForm({
        ...validValues,
        confirmPassword: "different-password",
      }).confirmPassword,
    ).toBe("Passwords must match.");

    expect(validateSignUpForm(validValues)).toEqual({});
  });

  it("keeps the login page linked to signup and shows registration success", () => {
    const html = renderToStaticMarkup(
      <LoginView
        email=""
        onEmailChange={vi.fn()}
        onPasswordChange={vi.fn()}
        onSubmit={vi.fn()}
        password=""
        submitError={null}
        submitting={false}
        successMessage="Account created successfully. Please sign in."
      />,
    );

    expect(html).toContain("Account created successfully. Please sign in.");
    expect(html).toContain("Don&#x27;t have an account?");
    expect(html).toContain('href="/signup"');
    expect(html).toContain("Sign up");
  });
});
