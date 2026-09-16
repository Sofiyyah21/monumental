export type StoredTokens = {
  accessToken: string;
};

export interface TokenStorage {
  read(): StoredTokens | null;
  write(tokens: StoredTokens): void;
  clear(): void;
}

const accessTokenKey = "monumental.accessToken";

export class SessionTokenStorage implements TokenStorage {
  read() {
    if (typeof window === "undefined") {
      return null;
    }

    const accessToken = window.sessionStorage.getItem(accessTokenKey);

    if (!accessToken) {
      return null;
    }

    return { accessToken };
  }

  write(tokens: StoredTokens) {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(accessTokenKey, tokens.accessToken);
  }

  clear() {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.removeItem(accessTokenKey);
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
