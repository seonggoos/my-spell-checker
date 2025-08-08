"use client";

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type Provider = "daum" | "pnu" | "all";

type SpellResult =
  | ({ type: string; context: string; source: "daum" } & {
      token: string;
      suggestions: string[];
    })
  | ({ info: string; source: "pnu" } & {
      token: string;
      suggestions: string[];
    });

export default function Home() {
  const [text, setText] = React.useState("");
  const [provider, setProvider] = React.useState<Provider>("daum");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<SpellResult[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
  const [candidate, setCandidate] = React.useState<string>("");
  const [warnings, setWarnings] = React.useState<string[]>([]);

  const runCheck = async (prov: Provider) => {
    setLoading(true);
    setError(null);
    setResults([]);
    setWarnings([]);
    try {
      const res = await fetch("/api/spellcheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, provider: prov }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "요청 실패");
      const arr: SpellResult[] = Array.isArray(data.results)
        ? data.results
        : [];
      setResults(arr);
      setSelectedIndex(arr.length > 0 ? 0 : null);
      setCandidate(arr.length > 0 ? arr[0]?.suggestions?.[0] ?? "" : "");
      setWarnings(
        Array.isArray(data.warnings) ? data.warnings.filter(Boolean) : []
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runCheck(provider);
  };

  // 교정 적용을 위한 보조 유틸
  type Normalized = {
    token: string;
    suggestion: string | null;
    source: "daum" | "pnu";
    type?: string;
    context?: string;
    info?: string;
  };

  const normalizedResults: Normalized[] = React.useMemo(() => {
    return results.map((r) => {
      // 좁히기: 두 변형 중 어떤 것인지 판별
      if ((r as { source?: unknown }).source === "daum") {
        const daum = r as Extract<SpellResult, { source: "daum" }>;
        return {
          token: daum.token,
          suggestion: daum.suggestions?.[0] ?? null,
          source: "daum",
          type: daum.type,
          context: daum.context,
        } satisfies Normalized;
      }
      const pnu = r as Extract<SpellResult, { source: "pnu" }>;
      return {
        token: pnu.token,
        suggestion: pnu.suggestions?.[0] ?? null,
        source: "pnu",
        info: pnu.info,
      } satisfies Normalized;
    });
  }, [results]);

  // 교정 문서(좌측): 최상위 제안으로 자동 교정한 결과를 보여줌
  const correctedPreview = React.useMemo(() => {
    if (!text || normalizedResults.length === 0) return text;

    // span 추출 (중복/겹침 방지)
    type Span = {
      start: number;
      end: number;
      token: string;
      suggestion: string;
      idx: number;
    };
    const spans: Span[] = [];

    for (let i = 0; i < normalizedResults.length; i += 1) {
      const { token, suggestion } = normalizedResults[i];
      if (!token || !suggestion) continue;
      let from = 0;
      while (true) {
        const found = text.indexOf(token, from);
        if (found === -1) break;
        const start = found;
        const end = found + token.length;
        // 겹침 방지
        const overlapped = spans.some(
          (s) =>
            (start >= s.start && start < s.end) ||
            (s.start >= start && s.start < end)
        );
        if (!overlapped) spans.push({ start, end, token, suggestion, idx: i });
        from = end;
      }
    }

    if (spans.length === 0) return text;
    spans.sort((a, b) => a.start - b.start);

    const out: React.ReactNode[] = [];
    let cursor = 0;
    spans.forEach((s, index) => {
      if (cursor < s.start) out.push(text.slice(cursor, s.start));
      out.push(
        <span
          key={`corr-${s.start}-${index}`}
          className="text-blue-600 underline"
        >
          {s.suggestion}
        </span>
      );
      cursor = s.end;
    });
    if (cursor < text.length) out.push(text.slice(cursor));
    return out;
  }, [text, normalizedResults]);

  const onSelectIssue = (idx: number) => {
    setSelectedIndex(idx);
    const s = normalizedResults[idx]?.suggestion ?? "";
    setCandidate(s);
  };

  const applyCandidateAll = () => {
    if (selectedIndex == null) return;
    const item = normalizedResults[selectedIndex];
    if (!item?.token || !candidate) return;
    const updated = text.split(item.token).join(candidate);
    setText(updated);
  };

  return (
    <div className="font-sans min-h-screen p-6 sm:p-10">
      <main className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">한글 맞춤법 검사</h1>
          <p className="text-sm text-muted-foreground">
            hanspell 기반. 서비스 선택: 다음/부산대/모두
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="검사할 텍스트를 입력하세요"
            className="min-h-40"
          />
          <div className="flex flex-wrap items-center gap-3">
            <fieldset className="flex items-center gap-3">
              <legend className="sr-only">Provider</legend>
              {(["daum", "pnu", "all"] as Provider[]).map((p) => (
                <label
                  key={p}
                  className="inline-flex items-center gap-2 text-sm cursor-pointer select-none"
                >
                  <input
                    type="radio"
                    name="provider"
                    value={p}
                    checked={provider === p}
                    onChange={() => setProvider(p)}
                    className="h-4 w-4 accent-foreground"
                  />
                  {p.toUpperCase()}
                </label>
              ))}
            </fieldset>
            <Button type="submit" disabled={loading || !text.trim()}>
              {loading ? "검사 중..." : "맞춤법 검사"}
            </Button>
          </div>
        </form>

        {error && <div className="text-sm text-destructive">오류: {error}</div>}

        {warnings.length > 0 && (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 text-yellow-900 text-sm p-3">
            일부 문장은 원격 서비스 오류로 교정에 실패했습니다. 다른 공급자로
            재시도하거나 다시 시도해 보세요.
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => runCheck("all")}
              >
                ALL로 재시도
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => runCheck(provider === "pnu" ? "daum" : "pnu")}
              >
                다른 서비스로 재시도
              </Button>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 좌측: 교정 문서 미리보기 */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">교정 문서</h2>
                <div className="text-xs text-muted-foreground">
                  {text.length}자
                </div>
              </div>
              <div className="rounded-md bg-background p-4 text-sm leading-7 min-h-24">
                {correctedPreview}
              </div>
            </div>

            {/* 우측: 상세 패널 & 목록 */}
            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium">
                    맞춤법/문법 오류 {results.length}개
                  </h2>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1">
                      <span className="size-2 rounded-full bg-red-500 inline-block" />
                      어법 오류
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="size-2 rounded-full bg-green-500 inline-block" />
                      문맥상 오류
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="size-2 rounded-full bg-blue-600 inline-block" />
                      분석 실패
                    </span>
                  </div>
                </div>

                {/* 상세 폼 */}
                {selectedIndex != null && normalizedResults[selectedIndex] && (
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        입력 내용
                      </div>
                      <div className="text-sm font-medium">
                        {normalizedResults[selectedIndex].token}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        대치어
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          value={candidate}
                          onChange={(e) => setCandidate(e.target.value)}
                          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        />
                        <Button type="button" onClick={applyCandidateAll}>
                          적용
                        </Button>
                      </div>
                    </div>
                    {(normalizedResults[selectedIndex].info ||
                      normalizedResults[selectedIndex].type ||
                      normalizedResults[selectedIndex].context) && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">
                          도움말
                        </div>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {normalizedResults[selectedIndex].info ||
                            normalizedResults[selectedIndex].type ||
                            normalizedResults[selectedIndex].context}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 목록 */}
              <ul className="space-y-2">
                {normalizedResults.map((r, idx) => (
                  <li key={idx}>
                    <button
                      type="button"
                      onClick={() => onSelectIssue(idx)}
                      className={
                        "w-full text-left rounded-md border p-3 text-sm transition-colors " +
                        (selectedIndex === idx
                          ? "bg-secondary"
                          : "hover:bg-accent")
                      }
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{r.token}</span>
                        <span className="px-2 py-0.5 text-xs rounded bg-background border">
                          {r.source.toUpperCase()}
                        </span>
                      </div>
                      {r.suggestion && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          제안: {r.suggestion}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
