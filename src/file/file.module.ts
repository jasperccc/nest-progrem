import { MulterModule } from '@nestjs/platform-express';
export const multerOptions = MulterModule.register({
  dest: './uploads', // 文件保存的目录
  limits: { fileSize: 100 * 1024 * 1024 }, // 最大 100MB
  fileFilter: (req, file, cb) => {
    // 允许 PDF、Markdown、TXT 和 DOCX
    if (!file.originalname.match(/\.(pdf|md|txt|docx)$/i)) {
      return cb(
        new Error('只允许上传 PDF、Markdown、TXT 或 DOCX 文件!'),
        false,
      );
    }
    cb(null, true);
  },
});
