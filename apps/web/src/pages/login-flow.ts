import type { CurrentUser } from "../api/types";

const loginFailureMessage = "Check your email and password, then try again.";

export async function submitLoginCredentials({
  email,
  password,
  login,
  onAuthenticated,
  onFailure,
}: {
  email: string;
  password: string;
  login(email: string, password: string): Promise<CurrentUser>;
  onAuthenticated(user: CurrentUser): void;
  onFailure(message: string): void;
}) {
  try {
    const user = await login(email, password);
    onAuthenticated(user);
  } catch {
    onFailure(loginFailureMessage);
  }
}
