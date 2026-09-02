import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentUserId } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { MistakesService } from "./mistakes.service";

@Controller("practice/mistakes")
@UseGuards(JwtAuthGuard)
export class MistakesController {
  constructor(private readonly mistakes: MistakesService) {}

  @Get()
  profile(@CurrentUserId() userId: string) {
    return this.mistakes.profile(userId);
  }
}
