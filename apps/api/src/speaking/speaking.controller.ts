import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { CreateSpeakingAttemptDto, SubmitSpeakingAttemptDto } from "./dto/speaking.dto";
import { SpeakingService } from "./speaking.service";

@Controller("speaking/attempts")
@UseGuards(JwtAuthGuard)
export class SpeakingController {
  constructor(private readonly speaking: SpeakingService) {}

  @Get()
  list(@CurrentUserId() userId: string, @Query() query: ListQueryDto) {
    return this.speaking.list(userId, query);
  }

  @Post()
  @UseGuards(UserThrottlerGuard, DailyAiQuotaGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  create(@CurrentUserId() userId: string, @Body() dto: CreateSpeakingAttemptDto) {
    return this.speaking.create(userId, dto);
  }

  @Get(":id")
  findOne(@CurrentUserId() userId: string, @Param("id") id: string) {
    return this.speaking.findOne(userId, id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUserId() userId: string, @Param("id") id: string) {
    return this.speaking.remove(userId, id);
  }

  @Post(":id/submit")
  @UseGuards(UserThrottlerGuard, DailyAiQuotaGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  submit(
    @CurrentUserId() userId: string,
    @Param("id") id: string,
    @Body() dto: SubmitSpeakingAttemptDto,
  ) {
    return this.speaking.submit(userId, id, dto);
  }

  @Post(":id/revise")
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  revise(@CurrentUserId() userId: string, @Param("id") id: string) {
    return this.speaking.revise(userId, id);
  }
}
