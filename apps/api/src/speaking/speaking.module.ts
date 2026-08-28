import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AuthModule } from "../auth/auth.module";
import { SpeakingController } from "./speaking.controller";
import { SpeakingService } from "./speaking.service";

@Module({
  imports: [AuthModule, AiModule],
  controllers: [SpeakingController],
  providers: [SpeakingService],
})
export class SpeakingModule {}
