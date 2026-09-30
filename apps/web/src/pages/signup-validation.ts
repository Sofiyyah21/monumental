export type SignUpFormValues = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export type SignUpFieldErrors = Partial<Record<keyof SignUpFormValues, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignUpForm(values: SignUpFormValues) {
  const errors: SignUpFieldErrors = {};

  if (!values.name.trim()) {
    errors.name = "Enter your full name.";
  }
  if (!values.email.trim()) {
    errors.email = "Enter your email address.";
  } else if (!emailPattern.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!values.password) {
    errors.password = "Enter a password.";
  }
  if (!values.confirmPassword) {
    errors.confirmPassword = "Confirm your password.";
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = "Passwords must match.";
  }

  return errors;
}
