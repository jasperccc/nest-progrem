import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

type SplitterOptions = {
  chunkSize: number;
  chunkOverlap: number;
  separators: string[];
};

function getPdfSplitterOptions(): SplitterOptions {
  return {
    chunkSize: 300,
    chunkOverlap: 50,
    separators: ['\n\n', '\n', '。', '！', '？', '；', '，', ' ', ''],
  };
}

function getMarkdownSplitterOptions(): SplitterOptions {
  return {
    chunkSize: 500,
    chunkOverlap: 80,
    separators: [
      '\n## ',
      '\n### ',
      '\n\n',
      '\n',
      '。',
      '！',
      '？',
      '；',
      ' ',
      '',
    ],
  };
}

function getPlainTextSplitterOptions(): SplitterOptions {
  return {
    chunkSize: 400,
    chunkOverlap: 60,
    separators: ['\n\n', '\n', '。', '！', '？', '；', '，', ' ', ''],
  };
}

function getDocxSplitterOptions(): SplitterOptions {
  return {
    chunkSize: 450,
    chunkOverlap: 70,
    separators: ['\n\n', '\n', '。', '！', '？', '；', '，', ' ', ''],
  };
}

export function createTextSplitter(filename: string) {
  let options: SplitterOptions;

  if (/\.pdf$/i.test(filename)) {
    options = getPdfSplitterOptions();
  } else if (/\.md$/i.test(filename)) {
    options = getMarkdownSplitterOptions();
  } else if (/\.txt$/i.test(filename)) {
    options = getPlainTextSplitterOptions();
  } else if (/\.docx$/i.test(filename)) {
    options = getDocxSplitterOptions();
  } else {
    options = getPlainTextSplitterOptions();
  }

  return new RecursiveCharacterTextSplitter(options);
}
