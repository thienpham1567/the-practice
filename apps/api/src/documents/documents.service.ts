import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { DEFAULT_PAGE_SIZE, toCursorPage } from "../common/cursor-page";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateDocumentDto, UpdateDocumentDto } from "./dto/document.dto";

/** Danh sách không kèm `content` — editor state nặng và không cần để hiển thị. */
const LIST_FIELDS = {
  id: true,
  title: true,
  grade: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DocumentSelect;

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ownerId: string, opts: { cursor?: string; limit?: number } = {}) {
    const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
    const rows = await this.prisma.document.findMany({
      where: { ownerId },
      select: LIST_FIELDS,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    return toCursorPage(rows, limit);
  }

  create(ownerId: string, dto: CreateDocumentDto) {
    return this.prisma.document.create({
      data: {
        ownerId,
        title: dto.title ?? "Untitled",
        content: dto.content as Prisma.InputJsonValue,
        plainText: dto.plainText,
        grade: dto.grade ?? null,
      },
    });
  }

  async findOne(ownerId: string, id: string) {
    const document = await this.prisma.document.findFirst({ where: { id, ownerId } });
    if (!document) throw new NotFoundException("Document not found");

    return document;
  }

  async update(ownerId: string, id: string, dto: UpdateDocumentDto) {
    await this.assertOwned(ownerId, id);

    return this.prisma.document.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content as Prisma.InputJsonValue }),
        ...(dto.plainText !== undefined && { plainText: dto.plainText }),
        ...(dto.grade !== undefined && { grade: dto.grade }),
      },
    });
  }

  async remove(ownerId: string, id: string): Promise<void> {
    await this.assertOwned(ownerId, id);
    await this.prisma.document.delete({ where: { id } });
  }

  /**
   * Không phân biệt "không tồn tại" với "của người khác": trả 404 cho cả hai,
   * nếu không thì 403 sẽ tiết lộ document nào có thật.
   */
  private async assertOwned(ownerId: string, id: string): Promise<void> {
    const found = await this.prisma.document.findFirst({
      where: { id, ownerId },
      select: { id: true },
    });

    if (!found) throw new NotFoundException("Document not found");
  }
}
