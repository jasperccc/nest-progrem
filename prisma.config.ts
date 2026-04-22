import 'dotenv/config';

// defineConfig 是 Prisma 7 提供的配置函数，有完整的 TypeScript 类型提示
import { defineConfig } from 'prisma/config';

export default defineConfig({
  // ── schema 文件路径 ──────────────────────────────────────
  // 告诉 Prisma CLI 去哪里找数据模型定义文件
  // 相对于 prisma.config.ts 所在目录（项目根目录）
  schema: 'prisma/schema.prisma',

  // ── 迁移文件存放目录 ─────────────────────────────────────
  // 每次执行 prisma migrate dev，生成的 SQL 文件存放在这里
  // 这些文件记录了每次数据库结构变更的历史
  migrations: {
    path: 'prisma/migrations',
  },

  // ── 数据库连接配置 ───────────────────────────────────────
  datasource: {
    // 数据库连接字符串，从 .env 文件读取
    // 格式：postgresql://用户名:密码@主机:端口/数据库名?schema=public
    url: process.env.DATABASE_URL as string,
  },
});
