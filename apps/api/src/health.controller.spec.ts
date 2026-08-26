import { ServiceUnavailableException } from "@nestjs/common";
import { HealthController } from "./health.controller";
import type { PrismaService } from "./prisma/prisma.service";

describe("HealthController", () => {
  it("live không chạm DB", () => {
    const prisma = { $queryRaw: jest.fn() };
    const controller = new HealthController(prisma as unknown as PrismaService);

    expect(controller.live()).toEqual({ status: "ok" });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("ready trả ok khi DB sống", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]) };
    const controller = new HealthController(prisma as unknown as PrismaService);

    await expect(controller.ready()).resolves.toEqual({ status: "ok" });
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it("ready trả 503 khi DB lỗi", async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error("db down")) };
    const controller = new HealthController(prisma as unknown as PrismaService);

    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("/health alias gọi cùng logic ready", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]) };
    const controller = new HealthController(prisma as unknown as PrismaService);

    await expect(controller.check()).resolves.toEqual({ status: "ok" });
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });
});
