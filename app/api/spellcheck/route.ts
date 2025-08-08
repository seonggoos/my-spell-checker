import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DaumResult = {
  type: string;
  token: string;
  suggestions: string[];
  context: string;
};

type PnuResult = {
  token: string;
  suggestions: string[];
  info: string;
};

type Provider = "daum" | "pnu" | "all";

type HanspellModule = {
  spellCheckByDAUM: (
    text: string,
    timeoutMs: number,
    onResult: (res: DaumResult) => void,
    onEnd: () => void,
    onError?: (err: unknown) => void
  ) => void;
  spellCheckByPNU: (
    text: string,
    timeoutMs: number,
    onResult: (res: PnuResult) => void,
    onEnd: () => void,
    onError?: (err: unknown) => void
  ) => void;
};

async function getHanspell(): Promise<HanspellModule> {
  const mod = (await import("hanspell")) as unknown as HanspellModule;
  return mod;
}

function splitIntoChunks(text: string, maxLen = 900): string[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  for (const line of lines) {
    if (line.length <= maxLen) {
      chunks.push(line);
      continue;
    }
    // 문장 단위로 추가 분할
    const sentences = line.split(/([.!?？!]+\s+|[\u3002\uFF0E]\s+|\.\s+)/g);
    let buffer = "";
    for (const part of sentences) {
      if (buffer.length + part.length > maxLen && buffer.length > 0) {
        chunks.push(buffer.trim());
        buffer = part;
      } else {
        buffer += part;
      }
    }
    if (buffer.trim()) chunks.push(buffer.trim());
  }
  return chunks.length > 0 ? chunks : [text];
}

async function checkByDaum(
  text: string,
  timeoutMs = 15000
): Promise<DaumResult[]> {
  const { spellCheckByDAUM } = await getHanspell();
  return new Promise((resolve, reject) => {
    const results: DaumResult[] = [];
    spellCheckByDAUM(
      text,
      timeoutMs,
      (res: unknown) => {
        const chunk = Array.isArray(res) ? res : [res];
        for (const item of chunk) {
          if (item && typeof item === "object") {
            results.push(item as DaumResult);
          }
        }
      },
      () => resolve(results),
      (err) => reject(err)
    );
  });
}

async function checkByPnu(
  text: string,
  timeoutMs = 15000
): Promise<PnuResult[]> {
  const { spellCheckByPNU } = await getHanspell();
  return new Promise((resolve, reject) => {
    const results: PnuResult[] = [];
    spellCheckByPNU(
      text,
      timeoutMs,
      (res: unknown) => {
        const chunk = Array.isArray(res) ? res : [res];
        for (const item of chunk) {
          if (item && typeof item === "object") {
            results.push(item as PnuResult);
          }
        }
      },
      () => resolve(results),
      (err) => reject(err)
    );
  });
}

type MultiOutput<T> = { results: T[]; warnings: string[] };

async function checkByDaumMulti(
  text: string
): Promise<MultiOutput<DaumResult>> {
  const chunks = splitIntoChunks(text);
  const out: DaumResult[] = [];
  const warnings: string[] = [];
  const settled = await Promise.allSettled(
    chunks.map((c) => checkByDaum(c, 12000))
  );
  for (const s of settled) {
    if (s.status === "fulfilled") out.push(...s.value);
    else warnings.push(String(s.reason ?? "DAUM 청크 처리 실패"));
  }
  return { results: out, warnings };
}

async function checkByPnuMulti(text: string): Promise<MultiOutput<PnuResult>> {
  const chunks = splitIntoChunks(text);
  const out: PnuResult[] = [];
  const warnings: string[] = [];
  const settled = await Promise.allSettled(
    chunks.map((c) => checkByPnu(c, 12000))
  );
  for (const s of settled) {
    if (s.status === "fulfilled") out.push(...s.value);
    else warnings.push(String(s.reason ?? "PNU 청크 처리 실패"));
  }
  return { results: out, warnings };
}

export async function POST(req: Request) {
  try {
    const { text, provider }: { text?: string; provider?: Provider } =
      await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { ok: false, error: "유효한 'text'가 필요합니다." },
        { status: 400 }
      );
    }

    const selected: Provider = provider ?? "daum";

    let daum: DaumResult[] = [];
    let pnu: PnuResult[] = [];

    let warnings: string[] = [];

    if (selected === "daum") {
      const { results: d, warnings: w } = await checkByDaumMulti(text);
      daum = d;
      warnings = w;
    } else if (selected === "pnu") {
      const { results: p, warnings: w } = await checkByPnuMulti(text);
      pnu = p;
      warnings = w;
    } else {
      // all
      const [daumOut, pnuOut] = await Promise.all([
        checkByDaumMulti(text),
        checkByPnuMulti(text),
      ]);
      daum = daumOut.results;
      pnu = pnuOut.results;
      warnings = [...daumOut.warnings, ...pnuOut.warnings];
    }

    const results = [
      ...daum.map((r) => ({ ...r, source: "daum" as const })),
      ...pnu.map((r) => ({ ...r, source: "pnu" as const })),
    ];

    return NextResponse.json({
      ok: true,
      provider: selected,
      text,
      results,
      warnings,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "서버 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
