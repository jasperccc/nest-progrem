import { MulterModule } from '@nestjs/platform-express';
export const multerOptions = MulterModule.register({
  dest: './uploads', // 文件保存的目录
  limits: { fileSize: 10 * 1024 * 1024 }, // 最大 10MB
  fileFilter: (req, file, cb) => {
    // 只允许 PDF
    if (!file.originalname.match(/\.(pdf)$/)) {
      return cb(new Error('只允许上传 PDF 文件!'), false);
    }
    cb(null, true);
  },
});
