import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RagService } from './rag/rag.service';
import { RagController } from './rag/rag.controller';
import { RagModule } from './rag/rag.module';
import { multerOptions } from './file/file.module';

@Module({
  imports: [RagModule, multerOptions],
  controllers: [AppController, RagController],
  providers: [AppService, RagService],
})
export class AppModule {}
