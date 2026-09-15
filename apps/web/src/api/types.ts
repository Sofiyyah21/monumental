export type UserRole = "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER";

export type Permission =
  | "manage:users"
  | "read:products"
  | "manage:products"
  | "read:inventory"
  | "manage:inventory"
  | "read:sales"
  | "create:sales"
  | "read:reports"
  | "read:admin-dashboard";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

export type AuthResponse = {
  user: CurrentUser;
  accessToken: string;
  refreshToken: string;
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;
