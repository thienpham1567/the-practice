import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { requestContext } from "./request-context";

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("x-request-id")?.trim();
  const requestId = header && header.length > 0 ? header : randomUUID();
  res.setHeader("x-request-id", requestId);
  // enterWith (not run): Express next() returns before async Nest handlers finish,
  // so run() would exit the store too early and logs would lose the request id.
  requestContext.enterWith({ requestId });
  next();
}
