function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (import.meta.env.PROD) {
    if (!configured) {
      throw new Error("VITE_API_BASE_URL is required for production builds");
    }
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(configured)) {
      throw new Error(
        "VITE_API_BASE_URL cannot point to localhost in production",
      );
    }
  }

  return configured ?? "/api/v1";
}

export const config = {
  apiBaseUrl: getApiBaseUrl(),
};
