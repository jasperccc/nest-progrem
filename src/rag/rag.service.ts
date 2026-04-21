import { Injectable } from '@nestjs/common';

@Injectable()
export class RagService {
  upload(file: any) {
    console.log('上传的PDF文件：', file);

    return {
      success: true,
      filePath: file.path,
      fileName: file.originalname,
      message: 'PDF 上传成功',
    };
  }
}
