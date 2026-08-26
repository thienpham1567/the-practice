import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { requestContext } from "./request-context";

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("x-request-id")?.trim();
  const requestId = header && header.length > 0 ? header : randomUUID();
  res.setHeader("x-request-id", requestId);
  requestContext.run({ requestId }, () => next());
}
