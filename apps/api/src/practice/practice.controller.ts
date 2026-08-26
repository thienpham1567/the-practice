import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUserId } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { UserThrottlerGuard } from "../ai/user-throttler.guard";
import { DailyAiQuotaGuard } from "../ai/daily-ai-quota.guard";
import { ListQueryDto } from "../common/list-query.dto";
import { CreateAttemptDto, SubmitAttemptDto, UpdateAttemptDto } from "./dto/practice.dto";
import { PracticeService } from "./practice.service";

@Controller("practice/attempts")
@UseGuards(JwtAuthGuard)
export class PracticeController {
  constructor(private readonly practice: PracticeService) {}

  @Get()
  list(@CurrentUserId() userId: string, @Query() query: ListQueryDto) {
    return this.practice.list(userId, query);
  }

  @Post()
  @UseGuards(UserThrottlerGuard, DailyAiQuotaGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  create(@CurrentUserId() userId: string, @Body() dto: CreateAttemptDto) {
    return this.practice.create(userId, dto);
  }

  @Get(":id")
  findOne(@CurrentUserId() userId: string, @Param("id") id: string) {
    return this.practice.findOne(userId, id);
  }

  @Patch(":id")
  update(
    @CurrentUserId() userId: string,
    @Param("id") id: string,
    @Body() dto: UpdateAttemptDto,
  ) {
    return this.practice.update(userId, id, dto);
  }

  @Post(":id/submit")
  @UseGuards(UserThrottlerGuard, DailyAiQuotaGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  submit(
    @CurrentUserId() userId: string,
    @Param("id") id: string,
    @Body() dto: SubmitAttemptDto,
  ) {
    return this.practice.submit(userId, id, dto);
  }
}
