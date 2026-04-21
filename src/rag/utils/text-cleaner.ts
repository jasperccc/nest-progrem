export function cleanPdfText(text: string): string {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;

      // 去掉纯页码
      if (/^\d+$/.test(line)) return false;

      // 去掉纯符号分隔线
      if (/^[-_=*.·•]{3,}$/.test(line)) return false;

      // 去掉常见目录点线
      if (/^[.\-·•\s\d]+$/.test(line)) return false;

      return true;
    });

  return lines.join('\n').trim();
}

export function cleanMarkdownText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function cleanPlainText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\u0000/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function cleanDocxText(text: string): string {
  const normalized = cleanPlainText(text);

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (/^\d+$/.test(line)) return false;
      if (/^[-_=*.·•]{3,}$/.test(line)) return false;
      return true;
    });

  return lines.join('\n').trim();
}

export function cleanTextByFileType(text: string, filename: string): string {
  if (/\.pdf$/i.test(filename)) {
    return cleanPdfText(text);
  }

  if (/\.md$/i.test(filename)) {
    return cleanMarkdownText(text);
  }

  if (/\.txt$/i.test(filename)) {
    return cleanPlainText(text);
  }

  if (/\.docx$/i.test(filename)) {
    return cleanDocxText(text);
  }

  return cleanPlainText(text);
}
