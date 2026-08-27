import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AuthModule } from "../auth/auth.module";
import { PracticeController } from "./practice.controller";
import { PracticeService } from "./practice.service";
import { ProgressService } from "./progress.service";
import { VocabController } from "./vocab.controller";
import { VocabService } from "./vocab.service";

@Module({
  imports: [AuthModule, AiModule],
  controllers: [PracticeController, VocabController],
  providers: [PracticeService, ProgressService, VocabService],
})
export class PracticeModule {}
