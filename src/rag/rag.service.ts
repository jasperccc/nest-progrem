import { Injectable } from '@nestjs/common';
// 文件上传引入
import * as fs from 'fs';
const { PDFParse } = require('pdf-parse');

@Injectable()
export class RagService {
  async upload(file: any) {
    try {
      //1,读取文件 buffer
      const fileBuffer = fs.readFileSync(file.path);
      // 2. 解析 PDF 文本
      const parser = new PDFParse({ data: fileBuffer });
      const pdfResult = await parser.getText();
      //   console.log('文本', pdfResult.text);
      //用完解析器之后直接销毁
      await parser.destroy();

      return {
        success: true,
        filePath: file.path,
        fileName: file.originalname,
        message: 'PDF 上传并解析成功',
        pdfText: pdfResult.text, // 解析后的文本
        pages: pdfResult.numpages, // 页数
      };
    } catch (e) {
      console.error('PDF上传/解析失败，错误详情:', e);
      return {
        success: false,
        message: 'PDF 上传失败',
        error: e,
      };
    }
  }
}
