import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Get,
  Param,
  Delete,
} from '@nestjs/common';
import { RagService } from './rag.service';
import { FileInterceptor } from '@nestjs/platform-express';
import 'multer';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  //上传文档自动入库
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPdf(@UploadedFile() file: Express.Multer.File) {
    return this.ragService.upload(file);
  }

  //向量检索提问
  @Post('query')
  async query(
    @Body()
    { message, sessionId }: { message: string; sessionId?: string },
  ) {
    return this.ragService.query(message, sessionId);
  }

  @Get('session')
  getSessions() {
    return this.ragService.listSessions();
  }

  @Get('session/:sessionId')
  getSession(@Param('sessionId') sessionId: string) {
    return this.ragService.getSession(sessionId);
  }

  @Delete('session/:sessionId')
  clearSession(@Param('sessionId') sessionId: string) {
    return this.ragService.clearSession(sessionId);
  }
}
