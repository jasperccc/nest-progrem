import { Document } from '@langchain/core/documents';

function normalizeText(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[，。！？；：、,.!?;:]/g, '')
    .trim()
    .toLowerCase();
}

function getPrefix(text: string, length = 120) {
  return normalizeText(text).slice(0, length);
}

export function dedupeRetrievedDocs(results: [Document, number][]) {
  const seen = new Set<string>();
  const deduped: [Document, number][] = [];

  for (const [doc, score] of results) {
    const key = getPrefix(doc.pageContent);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push([doc, score]);
  }

  return deduped;
}
