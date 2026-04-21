import {
  Body,
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

  //1.上传文件接口
  @Post('upload')
  @UseInterceptors(FileInterceptor('file')) // 字段名必须是 file
  uploadPdf(@UploadedFile() file: Express.Multer.File) {
    return this.ragService.upload(file);
  }
}
