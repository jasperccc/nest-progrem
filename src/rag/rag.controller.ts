import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { RagService } from './rag.service';
import { FileInterceptor } from '@nestjs/platform-express';
import 'multer';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPdf(@UploadedFile() file: Express.Multer.File) {
    return this.ragService.upload(file);
  }
}
