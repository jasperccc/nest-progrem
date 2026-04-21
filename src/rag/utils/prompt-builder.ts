import { Document } from '@langchain/core/documents';

export function createRagPrompt(message: string, docs: Document[]) {
  const context = docs
    .map((doc, index) => {
      return `片段${index + 1}（来源：${doc.metadata?.source || '未知来源'}）：
${doc.pageContent}`;
    })
    .join('\n\n');

  return `
你是一个基于知识库回答问题的助手。
你必须严格根据提供的上下文回答，不允许编造，不允许补充上下文中没有的信息。

请严格遵守以下规则：
1. 只能根据“上下文”回答问题。
2. 如果上下文不足以回答问题，必须明确说明证据不足。
3. 回答时必须引用片段编号，例如："片段1"、"片段2"。
4. citations 字段必须是字符串数组，例如：["片段1", "片段2"]。
5. 如果没有足够证据，insufficientEvidence 要明确说明缺少什么。
6. 你必须只输出合法 JSON，不要输出 markdown，不要输出解释，不要输出代码块。

输出 JSON 格式如下：
{
  "answer": "你的回答",
  "citations": ["片段1", "片段2"],
  "insufficientEvidence": "无"
}

上下文：
${context}

用户问题：
${message}
  `.trim();
}

export function parseRagJsonAnswer(content: string) {
  try {
    const parsed = JSON.parse(content);

    return {
      answer: typeof parsed.answer === 'string' ? parsed.answer : '',
      citations: Array.isArray(parsed.citations) ? parsed.citations : [],
      insufficientEvidence:
        typeof parsed.insufficientEvidence === 'string'
          ? parsed.insufficientEvidence
          : '',
    };
  } catch {
    return {
      answer: content,
      citations: [],
      insufficientEvidence: '模型输出不是合法 JSON',
    };
  }
}

//定义多轮对话的prompt
type ChatHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
};

export function createRewriteQuestionPrompt(
  message: string,
  history: ChatHistoryItem[] = [],
) {
  const historyText = history
    .map((item) => `${item.role === 'user' ? '用户' : '助手'}：${item.content}`)
    .join('\n');

  return `
你是一个查询改写助手。
你的任务是根据历史对话，把用户当前问题改写成一个“语义完整、适合知识库检索”的问题。

请严格遵守以下规则：
1. 只做问题补全和改写，不要回答问题。
2. 如果当前问题已经足够完整，就原样返回。
3. 如果当前问题里有“它、这个、那、上述、前者、后者”等指代，请结合历史补全。
4. 输出只能是改写后的一个问题，不要输出解释，不要输出多余内容。

历史对话：
${historyText || '无'}

当前问题：
${message}
  `.trim();
}
