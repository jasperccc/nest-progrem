import { Injectable } from '@nestjs/common';
// 文件上传引入
import * as fs from 'fs';
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
// 引入大模型
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { config } from '../config';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { Document } from '@langchain/core/documents';
//文本清洗
import { cleanTextByFileType } from './utils/text-cleaner';
//提示词
import {
  createRagPrompt,
  parseRagJsonAnswer,
  createRewriteQuestionPrompt,
} from './utils/prompt-builder';
//不同文件使用不同的切片
import { createTextSplitter } from './utils/chunk-splitter';
// 去重召回
import { dedupeRetrievedDocs } from './utils/deduplication-recall';

import {
  appendSessionMessage,
  createSessionId,
  deleteSession,
  getAllSessions,
  getSessionHistory,
  hasSession,
} from './utils/session-store';

type ChatHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
};

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

  private retrievalConfig = {
    recallTopK: 8,
    finalTopK: 4,
    scoreThreshold: 0.2,
  };

  //记录文档数量
  private docCount = 0;

  //加载文档到 Chroma
  async loadDocuments(
    documents: { id: string; content: string; source?: string }[],
  ) {
    const allDocs: Document[] = [];
    for (const doc of documents) {
      const splitter = createTextSplitter(doc.source || doc.id);
      //创建文档对象
      const chunks = await splitter.createDocuments(
        [doc.content],
        [{ source: doc.source || doc.id, docId: doc.id }],
      );
      console.log(
        '切片结果',
        chunks.map((chunk, index) => ({
          chunk: index + 1,
          length: chunk.pageContent.length,
          preview: chunk.pageContent.slice(0, 80),
        })),
      );

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
  private async retrieveContext(
    message: string,
    topK = this.retrievalConfig.recallTopK,
  ) {
    const vectorStore = await this.getVectorStore();
    //相似度检测
    return vectorStore.similaritySearchWithScore(message, topK);
  }

  //添加过滤方法
  private filterDocsByScore(results: [Document, number][], threshold: number) {
    return results.filter(([_, score]) => score >= threshold);
  }

  //增加一个重新历史问题的方法
  private async rewriteQuestion(
    message: string,
    history: ChatHistoryItem[] = [],
  ) {
    if (!history.length) {
      return message;
    }

    const prompt = createRewriteQuestionPrompt(message, history);
    const res = await this.llm.invoke(prompt);

    const content =
      typeof res.content === 'string'
        ? res.content
        : JSON.stringify(res.content);

    return content.trim();
  }

  // 文档上传接口
  async upload(file: any) {
    try {
      const isPdf = /\.pdf$/i.test(file.originalname);
      const isMarkdown = /\.md$/i.test(file.originalname);
      const isTxt = /\.txt$/i.test(file.originalname);
      const isDocx = /\.docx$/i.test(file.originalname);
      let parsedText = '';
      let numpages: number | undefined;

      if (isPdf) {
        // 1. 读取 PDF buffer
        const fileBuffer = fs.readFileSync(file.path);
        // 2. 解析 PDF 文本
        const parser = new PDFParse({ data: fileBuffer });
        const pdfResult = await parser.getText();
        parsedText = pdfResult.text;
        numpages = pdfResult.numpages;
        // 用完解析器后销毁，释放内存
        await parser.destroy();
      } else if (isMarkdown) {
        // Markdown 直接按文本读取
        parsedText = fs.readFileSync(file.path, 'utf-8');
      } else if (isTxt) {
        // TXT 直接按文本读取
        parsedText = fs.readFileSync(file.path, 'utf-8');
      } else if (isDocx) {
        // DOCX 通过 mammoth 提取纯文本
        const fileBuffer = fs.readFileSync(file.path);
        const docxResult = await mammoth.extractRawText({ buffer: fileBuffer });
        parsedText = docxResult.value;
      } else {
        throw new Error('暂不支持该文件类型');
      }

      const cleanedText = cleanTextByFileType(parsedText, file.originalname);

      // 添加文档入库逻辑
      const documents = [
        {
          id: file.name,
          content: cleanedText,
          source: file.originalname,
        },
      ];
      const loadResult = await this.loadDocuments(documents);
      console.log('loadResult', loadResult);

      return {
        success: true,
        filePath: file.path,
        fileName: file.originalname,
        message: '文件上传、解析并入库成功',
        fileText: cleanedText, // 解析后的文本
        pages: numpages, // PDF 页数，Markdown 无此字段
      };
    } catch (e) {
      console.error('PDF上传/解析失败，错误详情:', e);
      return {
        success: false,
        message: '文件上传失败',
        error: e,
      };
    }
  }

  //知识库问答
  async query(message: string, sessionId?: string) {
    try {
      //会话id
      let currentSessionId = sessionId;

      if (!currentSessionId || !hasSession(currentSessionId)) {
        currentSessionId = createSessionId();
      }

      const history = getSessionHistory(currentSessionId);

      const rewrittenQuestion = await this.rewriteQuestion(message, history);

      const results = await this.retrieveContext(
        rewrittenQuestion,
        this.retrievalConfig.recallTopK,
      );

      const filteredResults = this.filterDocsByScore(
        results,
        this.retrievalConfig.scoreThreshold,
      );

      const dedupedResults = dedupeRetrievedDocs(filteredResults);
      const finalResults = dedupedResults.slice(
        0,
        this.retrievalConfig.finalTopK,
      );

      if (!finalResults.length) {
        const noAnswer = '我无法从当前知识库中找到足够的信息';

        appendSessionMessage(currentSessionId, {
          role: 'user',
          content: message,
        });

        appendSessionMessage(currentSessionId, {
          role: 'assistant',
          content: noAnswer,
        });

        return {
          success: false,
          sessionId: currentSessionId,
          question: message,
          rewrittenQuestion,
          answer: noAnswer,
          citations: [],
          insufficientEvidence: '知识库中没有足够相关的内容',
          sources: [],
        };
      }

      const docs = finalResults.map(([doc]) => doc);
      const prompt = createRagPrompt(rewrittenQuestion, docs);

      const res = await this.llm.invoke(prompt);
      const content =
        typeof res.content === 'string'
          ? res.content
          : JSON.stringify(res.content);

      const parsed = parseRagJsonAnswer(content);

      appendSessionMessage(currentSessionId, {
        role: 'user',
        content: message,
      });

      appendSessionMessage(currentSessionId, {
        role: 'assistant',
        content: parsed.answer,
      });

      return {
        success: true,
        sessionId: currentSessionId,
        question: message,
        rewrittenQuestion,
        raw: content,
        answer: parsed.answer,
        citations: parsed.citations,
        insufficientEvidence: parsed.insufficientEvidence,
        sources: finalResults.map(([doc, score], index) => ({
          chunkId: `片段${index + 1}`,
          score,
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

  //获取会话
  getSession(sessionId: string) {
    if (!hasSession(sessionId)) {
      return {
        success: false,
        message: '会话不存在',
        sessionId,
        history: [],
      };
    }

    return {
      success: true,
      sessionId,
      history: getSessionHistory(sessionId),
    };
  }

  //清空会话
  clearSession(sessionId: string) {
    if (!hasSession(sessionId)) {
      return {
        success: false,
        message: '会话不存在',
        sessionId,
      };
    }

    deleteSession(sessionId);

    return {
      success: true,
      message: '会话已清空',
      sessionId,
    };
  }

  //获取会话列表
  listSessions() {
    return {
      success: true,
      sessions: getAllSessions(),
    };
  }
}
