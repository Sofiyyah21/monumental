import { describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "../api/types";
import { submitLoginCredentials } from "./login-flow";

const adminUser: CurrentUser = {
  id: "admin_1",
  email: "admin@monumental.test",
  name: "Admin User",
  role: "ADMIN",
};

describe("submitLoginCredentials", () => {
  it("invokes the authentication flow and returns the authenticated user to routing", async () => {
    const login = vi.fn(async () => adminUser);
    const onAuthenticated = vi.fn();
    const onFailure = vi.fn();

    await submitLoginCredentials({
      email: "admin@monumental.test",
      password: "password123",
      login,
      onAuthenticated,
      onFailure,
    });

    expect(login).toHaveBeenCalledWith("admin@monumental.test", "password123");
    expect(onAuthenticated).toHaveBeenCalledWith(adminUser);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("keeps failed login attempts on the user-facing error path", async () => {
    const login = vi.fn(async () => {
      throw new Error("Invalid email or password");
    });
    const onAuthenticated = vi.fn();
    const onFailure = vi.fn();

    await submitLoginCredentials({
      email: "admin@monumental.test",
      password: "wrong-password",
      login,
      onAuthenticated,
      onFailure,
    });

    expect(login).toHaveBeenCalledWith(
      "admin@monumental.test",
      "wrong-password",
    );
    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledWith(
      "Check your email and password, then try again.",
    );
  });
});
