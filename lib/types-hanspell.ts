// Ambient module declaration for 'hanspell' (no official @types)
// Ensures TypeScript can type-check API route importing this CJS package

declare module "hanspell" {
  export type DaumResult = {
    type: string;
    token: string;
    suggestions: string[];
    context: string;
  };

  export type PnuResult = {
    token: string;
    suggestions: string[];
    info: string;
  };

  export function spellCheckByDAUM(
    text: string,
    timeoutMs: number,
    onResult: (res: DaumResult) => void,
    onEnd: () => void,
    onError?: (err: unknown) => void
  ): void;

  export function spellCheckByPNU(
    text: string,
    timeoutMs: number,
    onResult: (res: PnuResult) => void,
    onEnd: () => void,
    onError?: (err: unknown) => void
  ): void;
}
