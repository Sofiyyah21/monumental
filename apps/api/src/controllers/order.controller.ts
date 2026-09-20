import type {
  OrderPaymentStatus,
  OrderStatus,
  Prisma,
  ProductCategory,
  ProductUnit,
  UserRole,
} from "@prisma/client";
import type { Request, Response } from "express";
import {
  permissions,
  roleHasPermission,
} from "../authorization/permissions.js";
import { AppError } from "../lib/app-error.js";
import { OrderService } from "../services/order.service.js";

type OrderResponseSource = {
  id: string;
  reference: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  subtotal: Prisma.Decimal;
  confirmedAt: Date | null;
  confirmedById: string | null;
  paidAt: Date | null;
  paidById: string | null;
  fulfilledAt: Date | null;
  fulfilledById: string | null;
  cancelledAt: Date | null;
  cancelledById: string | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  items?: Array<{
    id: string;
    productId: string;
    productName: string;
    productSku: string;
    productCategory: ProductCategory;
    productUnit: ProductUnit;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    lineSubtotal: Prisma.Decimal;
    createdAt: Date;
  }>;
};

export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  list = async (req: Request, res: Response) => {
    const user = this.requireUser(req);
    const result = await this.orderService.list({
      ...req.query,
      requesterId: user.id,
      requesterRole: user.role,
    });
    res.json({
      success: true,
      data: result.map((order) => toOrderResponse(order, user.role)),
    });
  };

  getById = async (req: Request<{ id: string }>, res: Response) => {
    const user = this.requireUser(req);
    const result = await this.orderService.getById({
      orderId: req.params.id,
      requesterId: user.id,
      requesterRole: user.role,
    });
    res.json({ success: true, data: toOrderResponse(result, user.role) });
  };

  create = async (req: Request, res: Response) => {
    const user = this.requireUser(req);
    const result = await this.orderService.create({
      customerId: user.id,
      requesterRole: user.role,
      items: req.body.items,
    });
    res
      .status(201)
      .json({ success: true, data: toOrderResponse(result, user.role) });
  };

  cancel = async (req: Request<{ id: string }>, res: Response) => {
    const user = this.requireUser(req);
    const result = await this.orderService.cancel({
      orderId: req.params.id,
      requesterId: user.id,
      requesterRole: user.role,
      reason: req.body.reason,
    });
    res.json({ success: true, data: toOrderResponse(result, user.role) });
  };

  confirm = async (req: Request<{ id: string }>, res: Response) => {
    const user = this.requireUser(req);
    const result = await this.orderService.confirm({
      orderId: req.params.id,
      requesterId: user.id,
      requesterRole: user.role,
    });
    res.json({ success: true, data: toOrderResponse(result, user.role) });
  };

  fulfill = async (req: Request<{ id: string }>, res: Response) => {
    const user = this.requireUser(req);
    const result = await this.orderService.fulfill({
      orderId: req.params.id,
      requesterId: user.id,
      requesterRole: user.role,
    });
    res.json({ success: true, data: toOrderResponse(result, user.role) });
  };

  verifyPayment = async (req: Request<{ id: string }>, res: Response) => {
    const user = this.requireUser(req);
    const result = await this.orderService.verifyPayment({
      orderId: req.params.id,
      requesterId: user.id,
      requesterRole: user.role,
    });
    res.json({ success: true, data: toOrderResponse(result, user.role) });
  };

  private requireUser(req: Request) {
    if (!req.user) {
      throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
    }
    return req.user;
  }
}

function toOrderResponse(order: OrderResponseSource, requesterRole: UserRole) {
  const includeInternalPaymentAudit = roleHasPermission(
    requesterRole,
    permissions.READ_ORDERS,
  );

  return {
    id: order.id,
    reference: order.reference,
    status: order.status,
    paymentStatus: order.paymentStatus,
    subtotal: order.subtotal,
    confirmedAt: order.confirmedAt,
    confirmedById: order.confirmedById,
    paidAt: order.paidAt,
    ...(includeInternalPaymentAudit ? { paidById: order.paidById } : {}),
    fulfilledAt: order.fulfilledAt,
    fulfilledById: order.fulfilledById,
    cancelledAt: order.cancelledAt,
    cancelledById: order.cancelledById,
    cancelReason: order.cancelReason,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: (order.items ?? []).map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      productSku: item.productSku,
      productCategory: item.productCategory,
      productUnit: item.productUnit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineSubtotal: item.lineSubtotal,
      createdAt: item.createdAt,
    })),
  };
}
