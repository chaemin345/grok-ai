const BASE = "https://www.law.go.kr/DRF";

export interface LawSearchItem {
  법령명한글: string;
  법령ID: string;
  법령일련번호: string;
  법령약칭명?: string;
}

/** 국가법령정보센터 법령명 검색 */
export async function searchLaw(query: string): Promise<LawSearchItem[]> {
  const oc = process.env.LAW_API_OC;
  if (!oc) {
    console.warn("[law-api] LAW_API_OC 없음 → mock");
    return mockSearch(query);
  }

  const url = new URL(`${BASE}/lawSearch.do`);
  url.searchParams.set("OC", oc);
  url.searchParams.set("target", "law");
  url.searchParams.set("type", "JSON");
  url.searchParams.set("query", query);
  url.searchParams.set("display", "5");
  url.searchParams.set("search", "1");

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`lawSearch ${res.status}`);
    const data = await res.json();
    const list = data?.LawSearch?.law ?? data?.law ?? [];
    return Array.isArray(list) ? list : [list].filter(Boolean);
  } catch (e) {
    console.error("[law-api] search error", e);
    return mockSearch(query);
  }
}

/**
 * 조문 존재 여부 확인
 * JO 형식: 6자리 (제2조 → 000200, 제10조의2 → 001002)
 */
export async function checkArticleExists(
  lawId: string,
  articleStr: string
): Promise<{ exists: boolean; detail?: string; uncertain?: boolean }> {
  const oc = process.env.LAW_API_OC;
  if (!oc || !lawId || lawId === "000000") {
    return mockArticleCheck(articleStr);
  }

  const jo = parseArticleToJO(articleStr);
  if (!jo) {
    return {
      exists: true,
      uncertain: true,
      detail: `${articleStr} 형식 파싱 실패로 조문 존재 여부를 확정할 수 없습니다.`,
    };
  }

  try {
    const url = new URL(`${BASE}/lawService.do`);
    url.searchParams.set("OC", oc);
    url.searchParams.set("target", "lawjosub");
    url.searchParams.set("type", "JSON");
    url.searchParams.set("ID", lawId);
    url.searchParams.set("JO", jo);

    const res = await fetch(url.toString(), {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return {
        exists: true,
        uncertain: true,
        detail: `조문 조회 API 응답 오류(${res.status}). 수동 확인을 권장합니다.`,
      };
    }

    const data = await res.json();
    const hasContent =
      data &&
      (data.법령 ||
        data.조문 ||
        data.Law ||
        data.조문내용 ||
        (typeof data === "object" && Object.keys(data).length > 2));

    if (!hasContent) {
      return {
        exists: false,
        detail: `법령 ID ${lawId} 에서 ${articleStr} 에 해당하는 조문을 찾을 수 없습니다. 조문 번호 오류 또는 폐지된 조문일 수 있습니다.`,
      };
    }

    return { exists: true };
  } catch (e) {
    console.error("[law-api] article check error", e);
    return {
      exists: true,
      uncertain: true,
      detail: `조문 조회 중 네트워크 오류. 수동 확인을 권장합니다.`,
    };
  }
}

/** "제15조", "제15조의2", "제15조 제1항" 등 → JO 6자리 문자열 */
function parseArticleToJO(article: string): string | null {
  const m = article.match(/제\s*(\d+)\s*조(?:의\s*(\d+))?/);
  if (!m) return null;
  const main = parseInt(m[1], 10);
  const sub = m[2] ? parseInt(m[2], 10) : 0;
  if (isNaN(main) || main < 1 || main > 9999) return null;
  return String(main).padStart(4, "0") + String(sub).padStart(2, "0");
}

function mockSearch(query: string): LawSearchItem[] {
  const known = [
    "민법",
    "형법",
    "상법",
    "근로기준법",
    "개인정보 보호법",
    "저작권법",
    "행정소송법",
    "민사소송법",
  ];
  const hit = known.find((k) => query.includes(k) || k.includes(query));
  if (!hit) return [];
  return [
    {
      법령명한글: hit,
      법령ID: "000000",
      법령일련번호: "000000",
      법령약칭명: hit,
    },
  ];
}

function mockArticleCheck(articleStr: string): {
  exists: boolean;
  detail?: string;
  uncertain?: boolean;
} {
  const m = articleStr.match(/제\s*(\d+)\s*조/);
  if (m && parseInt(m[1], 10) > 2000) {
    return {
      exists: false,
      detail: `mock: ${articleStr} 은(는) 존재하지 않는 조문으로 간주합니다.`,
    };
  }
  if (m && parseInt(m[1], 10) === 0) {
    return { exists: false, detail: `제0조는 존재하지 않습니다.` };
  }
  return { exists: true };
}
