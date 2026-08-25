import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AuthModule } from "../auth/auth.module";
import { PracticeController } from "./practice.controller";
import { PracticeService } from "./practice.service";

@Module({
  imports: [AuthModule, AiModule],
  controllers: [PracticeController],
  providers: [PracticeService],
})
export class PracticeModule {}
