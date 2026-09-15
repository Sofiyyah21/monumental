export type StoredTokens = {
  accessToken: string;
  refreshToken: string;
};

export interface TokenStorage {
  read(): StoredTokens | null;
  write(tokens: StoredTokens): void;
  clear(): void;
}

const accessTokenKey = "monumental.accessToken";
const refreshTokenKey = "monumental.refreshToken";

export class SessionTokenStorage implements TokenStorage {
  read() {
    if (typeof window === "undefined") {
      return null;
    }

    const accessToken = window.sessionStorage.getItem(accessTokenKey);
    const refreshToken = window.sessionStorage.getItem(refreshTokenKey);

    if (!accessToken || !refreshToken) {
      return null;
    }

    return { accessToken, refreshToken };
  }

  write(tokens: StoredTokens) {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(accessTokenKey, tokens.accessToken);
    window.sessionStorage.setItem(refreshTokenKey, tokens.refreshToken);
  }

  clear() {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.removeItem(accessTokenKey);
    window.sessionStorage.removeItem(refreshTokenKey);
  }
}

export class MemoryTokenStorage implements TokenStorage {
  private tokens: StoredTokens | null = null;

  read() {
    return this.tokens;
  }

  write(tokens: StoredTokens) {
    this.tokens = tokens;
  }

  clear() {
    this.tokens = null;
  }
}
