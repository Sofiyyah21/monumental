import type {
  OrderPaymentStatus,
  OrderStatus,
  Prisma,
  ProductCategory,
  ProductUnit,
} from "@prisma/client";
import type { Request, Response } from "express";
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
    res.json({ success: true, data: result.map(toOrderResponse) });
  };

  getById = async (req: Request<{ id: string }>, res: Response) => {
    const user = this.requireUser(req);
    const result = await this.orderService.getById({
      orderId: req.params.id,
      requesterId: user.id,
      requesterRole: user.role,
    });
    res.json({ success: true, data: toOrderResponse(result) });
  };

  create = async (req: Request, res: Response) => {
    const user = this.requireUser(req);
    const result = await this.orderService.create({
      customerId: user.id,
      requesterRole: user.role,
      items: req.body.items,
    });
    res.status(201).json({ success: true, data: toOrderResponse(result) });
  };

  cancel = async (req: Request<{ id: string }>, res: Response) => {
    const user = this.requireUser(req);
    const result = await this.orderService.cancel({
      orderId: req.params.id,
      requesterId: user.id,
      requesterRole: user.role,
      reason: req.body.reason,
    });
    res.json({ success: true, data: toOrderResponse(result) });
  };

  confirm = async (req: Request<{ id: string }>, res: Response) => {
    const user = this.requireUser(req);
    const result = await this.orderService.confirm({
      orderId: req.params.id,
      requesterId: user.id,
      requesterRole: user.role,
    });
    res.json({ success: true, data: toOrderResponse(result) });
  };

  fulfill = async (req: Request<{ id: string }>, res: Response) => {
    const user = this.requireUser(req);
    const result = await this.orderService.fulfill({
      orderId: req.params.id,
      requesterId: user.id,
      requesterRole: user.role,
    });
    res.json({ success: true, data: toOrderResponse(result) });
  };

  private requireUser(req: Request) {
    if (!req.user) {
      throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
    }
    return req.user;
  }
}

function toOrderResponse(order: OrderResponseSource) {
  return {
    id: order.id,
    reference: order.reference,
    status: order.status,
    paymentStatus: order.paymentStatus,
    subtotal: order.subtotal,
    confirmedAt: order.confirmedAt,
    confirmedById: order.confirmedById,
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
