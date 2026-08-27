import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { CurrentUserId } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ListQueryDto } from "../common/list-query.dto";
import { VocabService } from "./vocab.service";

@Controller("practice/vocab")
@UseGuards(JwtAuthGuard)
export class VocabController {
  constructor(private readonly vocab: VocabService) {}

  @Get()
  list(@CurrentUserId() userId: string, @Query() query: ListQueryDto) {
    return this.vocab.list(userId, query);
  }
}
