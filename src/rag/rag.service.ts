import { Injectable } from '@nestjs/common';
// 文件上传引入
import * as fs from 'fs';
const { PDFParse } = require('pdf-parse');
// 引入大模型
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { config } from '../config';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { Document } from '@langchain/core/documents';
@Injectable()
export class RagService {
  // 引入大模型
  private llm = new ChatOpenAI({
    model: config.ollama.chatModel,
    apiKey: config.ollama.OPENAI_API_KEY,
    configuration: { baseURL: config.ollama.baseUrl },
    temperature: 0.5,
  });
  //引入向量模型
  private embeddings = new OpenAIEmbeddings({
    model: config.ollama.embedModel,
    apiKey: config.ollama.OPENAI_API_KEY,
    configuration: { baseURL: config.ollama.baseUrlEmbed },
  });

  // Chroma 服务配置
  private chromaConfig = {
    // Chroma 服务地址（Docker 启动默认是 localhost:8000）
    url: 'http://localhost:8000',
    // Collection 名称（类似数据库里的"表名"）
    collectionName: 'rag-knowledge-base',
  };

  //记录文档数量
  private docCount = 0;

  // ── 加载文档到 Chroma ──────────────────────────────────
  async loadDocuments(
    documents: { id: string; content: string; source?: string }[],
  ) {
    //文档切分规则
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
      separators: ['\n\n', '\n', '。', '！', '？', ' ', ''],
    });

    const allDocs: Document[] = [];
    for (const doc of documents) {
      //创建文档对象
      const chunks = await splitter.createDocuments(
        [doc.content],
        [{ source: doc.source || doc.id, docId: doc.id }],
      );
      console.log('chunks', chunks);

      allDocs.push(...chunks);
    }
    // Chroma.fromDocuments：
    // 1. 连接 Chroma 服务（http://localhost:8000）
    // 2. 如果 collection 不存在，自动创建
    // 3. 向量化所有文档块并存入 Chroma
    //传三个参数：切分的文档块，向量化模型，Chroma 配置
    await Chroma.fromDocuments(allDocs, this.embeddings, {
      collectionName: this.chromaConfig.collectionName,
      url: this.chromaConfig.url,
    });

    //记录文档数量
    this.docCount += documents.length;

    return {
      success: true,
      originalDocs: documents.length,
      totalChunks: allDocs.length,
      message: `已将 ${documents.length} 篇文档（${allDocs.length} 个块）存入 Chroma`,
    };
  }

  // ------用户问答逻辑-------------
  // 获取 Chroma vectorStore 实例（用于检索）
  //这个操作时是把库连出来做检索
  private async getVectorStore(): Promise<Chroma> {
    // 连接到已有的 collection（不会清空数据）
    return new Chroma(this.embeddings, {
      collectionName: this.chromaConfig.collectionName,
      url: this.chromaConfig.url,
    });
  }

  // 检索上下文
  private async retrieveContext(message: string, topK = 3) {
    const vectorStore = await this.getVectorStore();
    //相似度检测
    const docs = await vectorStore.similaritySearch(message, topK);
    return docs;
  }

  // 拼prompt
  private createPrompt(message: string, docs: Document[]) {
    const context = docs
      .map((doc, index) => {
        return `片段${index + 1}：\n${doc.pageContent}`;
      })
      .join('\n\n');
    return `
      你是一个基于知识库回答问题的助手。
      请严格依据提供的上下文回答问题。
      如果上下文里找不到答案，就明确回答“我无法从当前知识库中找到答案”，不要编造内容。
      上下文：${context}
      用户问题：${message}`.trim();
  }

  // 文档上传接口
  async upload(file: any) {
    try {
      //1,读取文件 buffer
      const fileBuffer = fs.readFileSync(file.path);
      // 2. 解析 PDF 文本
      const parser = new PDFParse({ data: fileBuffer });
      const pdfResult = await parser.getText();
      //   console.log('文本', pdfResult.text);
      //用完解析器之后直接销毁，释放内存
      await parser.destroy();

      // 添加文档入库逻辑
      const documents = [
        {
          id: file.name,
          content: pdfResult.text,
          source: file.originalname,
        },
      ];
      const loadResult = await this.loadDocuments(documents);
      console.log('loadResult', loadResult);

      return {
        success: true,
        filePath: file.path,
        fileName: file.originalname,
        message: 'PDF 上传,解析并入库成功',
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

  //知识库问答
  async query(message: string, topK: number) {
    try {
      const docs = await this.retrieveContext(message, topK);
      if (!docs.length) {
        return {
          success: false,
          message: '无法从当前知识库中找到答案',
          source: [],
        };
      }
      const prompt = this.createPrompt(message, docs);
      const res = await this.llm.invoke(prompt);
      return {
        success: true,
        message: res.content,
        sources: docs.map((doc) => ({
          content: doc.pageContent,
          metadata: doc.metadata,
        })),
      };
    } catch (e) {
      console.error('知识库问答失败，错误详情:', e);
      return {
        success: false,
        message: '知识库问答失败',
        error: e,
      };
    }
  }
}
