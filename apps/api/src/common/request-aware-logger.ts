import { ConsoleLogger } from "@nestjs/common";
import { getRequestId } from "./request-context";

/** Prefaces every log line with the active request id when present. */
export class RequestAwareLogger extends ConsoleLogger {
  private withRequestId(message: unknown): unknown {
    const requestId = getRequestId();
    if (!requestId) return message;
    if (typeof message === "string") return `[req=${requestId}] ${message}`;
    return message;
  }

  override log(message: unknown, ...optionalParams: unknown[]): void {
    super.log(this.withRequestId(message), ...optionalParams);
  }

  override error(message: unknown, ...optionalParams: unknown[]): void {
    super.error(this.withRequestId(message), ...optionalParams);
  }

  override warn(message: unknown, ...optionalParams: unknown[]): void {
    super.warn(this.withRequestId(message), ...optionalParams);
  }

  override debug(message: unknown, ...optionalParams: unknown[]): void {
    super.debug?.(this.withRequestId(message), ...optionalParams);
  }

  override verbose(message: unknown, ...optionalParams: unknown[]): void {
    super.verbose?.(this.withRequestId(message), ...optionalParams);
  }
}
