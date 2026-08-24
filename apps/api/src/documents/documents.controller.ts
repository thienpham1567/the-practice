import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUserId } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { DocumentsService } from "./documents.service";
import { CreateDocumentDto, UpdateDocumentDto } from "./dto/document.dto";

@Controller("documents")
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@CurrentUserId() userId: string) {
    return this.documents.list(userId);
  }

  @Post()
  create(@CurrentUserId() userId: string, @Body() dto: CreateDocumentDto) {
    return this.documents.create(userId, dto);
  }

  @Get(":id")
  findOne(@CurrentUserId() userId: string, @Param("id") id: string) {
    return this.documents.findOne(userId, id);
  }

  @Patch(":id")
  update(
    @CurrentUserId() userId: string,
    @Param("id") id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documents.update(userId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUserId() userId: string, @Param("id") id: string): Promise<void> {
    return this.documents.remove(userId, id);
  }
}
