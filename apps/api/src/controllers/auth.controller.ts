import type { Request, Response } from "express";
import {
  assertTrustedCookieRequest,
  clearRefreshTokenCookie,
  getRefreshTokenCookie,
  setRefreshTokenCookie,
} from "../lib/auth-cookie.js";
import { AppError } from "../lib/app-error.js";
import { AuthService } from "../services/auth.service.js";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  registerCustomer = async (req: Request, res: Response) => {
    const result = await this.authService.registerCustomer(req.body);
    res.status(201).json({ success: true, data: result });
  };

  createUser = async (req: Request, res: Response) => {
    const result = await this.authService.createUser(req.body);
    res.status(201).json({ success: true, data: result });
  };

  login = async (req: Request, res: Response) => {
    const result = await this.authService.login(
      req.body.email,
      req.body.password,
    );
    setRefreshTokenCookie(res, result.refreshToken);
    res.json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  };

  refresh = async (req: Request, res: Response) => {
    assertTrustedCookieRequest(req);
    const refreshToken = getRefreshTokenCookie(req);
    if (!refreshToken) {
      throw new AppError(
        "Invalid or expired refresh token",
        401,
        "INVALID_REFRESH_TOKEN",
      );
    }

    const result = await this.authService.refresh(refreshToken);
    setRefreshTokenCookie(res, result.refreshToken);
    res.json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  };

  logout = async (req: Request, res: Response) => {
    assertTrustedCookieRequest(req);
    const refreshToken = getRefreshTokenCookie(req);
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    clearRefreshTokenCookie(res);
    res.status(204).send();
  };

  me = async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
    }
    const result = await this.authService.getCurrentUser(req.user.id);
    res.json({ success: true, data: result });
  };
}
