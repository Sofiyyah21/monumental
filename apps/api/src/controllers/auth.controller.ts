import type { Request, Response } from "express";
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
    res.json({ success: true, data: result });
  };

  refresh = async (req: Request, res: Response) => {
    const result = await this.authService.refresh(req.body.refreshToken);
    res.json({ success: true, data: result });
  };

  logout = async (req: Request, res: Response) => {
    await this.authService.logout(req.body.refreshToken);
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
