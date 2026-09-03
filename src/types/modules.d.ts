declare module 'mammoth' {
  interface ConvertResult {
    value: string;
    messages: any[];
  }
  export function convertToMarkdown(
    input: { path?: string; buffer?: Buffer },
    options?: any
  ): Promise<ConvertResult>;
  export function extractRawText(
    input: { path?: string; buffer?: Buffer },
    options?: any
  ): Promise<ConvertResult>;
  export const images: {
    imgElement: (func: (element: any) => Promise<{ src: string; alt?: string } | void>) => any;
    inline: (func: (element: any) => Promise<{ src: string; alt?: string } | void>) => any;
    dataUri: any;
    imageFilenameExtension: any;
  };
}

declare module 'word-extractor' {
  class WordExtractor {
    extract(path: string): Promise<{
      getBody(): string;
      getFootnotes(): string;
      getHeaders(): string;
      getAnnotations(): string;
    }>;
  }
  export default WordExtractor;
}
