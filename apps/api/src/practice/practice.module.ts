import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AuthModule } from "../auth/auth.module";
import { MistakesController } from "./mistakes.controller";
import { MistakesService } from "./mistakes.service";
import { PracticeController } from "./practice.controller";
import { PracticeService } from "./practice.service";
import { ProgressController } from "./progress.controller";
import { ProgressService } from "./progress.service";
import { VocabController } from "./vocab.controller";
import { VocabService } from "./vocab.service";

@Module({
  imports: [AuthModule, AiModule],
  controllers: [PracticeController, ProgressController, VocabController, MistakesController],
  providers: [PracticeService, ProgressService, VocabService, MistakesService],
})
export class PracticeModule {}
