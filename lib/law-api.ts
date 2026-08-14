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
    const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
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
): Promise<{ exists: boolean; detail?: string }> {
  const oc = process.env.LAW_API_OC;
  if (!oc || !lawId || lawId === "000000") {
    // mock 모드에서는 알려진 조문만 통과
    return mockArticleCheck(articleStr);
  }

  const jo = parseArticleToJO(articleStr);
  if (!jo) {
    return { exists: true }; // 파싱 실패 시 보수적으로 통과
  }

  try {
    const url = new URL(`${BASE}/lawService.do`);
    url.searchParams.set("OC", oc);
    url.searchParams.set("target", "lawjosub");
    url.searchParams.set("type", "JSON");
    url.searchParams.set("ID", lawId);
    url.searchParams.set("JO", jo);

    const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!res.ok) {
      // 404 등이면 조문 없음으로 간주할 수 있으나, API 특성상 빈 응답일 수 있음
      return { exists: true };
    }

    const data = await res.json();
    // 응답에 조문 관련 필드가 있으면 존재
    const hasContent =
      data &&
      (data.법령 ||
        data.조문 ||
        data.Law ||
        data.조문내용 ||
        Object.keys(data).length > 2);

    if (!hasContent) {
      return {
        exists: false,
        detail: `법령 ID ${lawId} 에서 ${articleStr} 에 해당하는 조문을 찾을 수 없습니다.`,
      };
    }

    return { exists: true };
  } catch (e) {
    console.error("[law-api] article check error", e);
    return { exists: true }; // 오류 시 보수적으로 통과
  }
}

/** "제15조", "제15조의2", "제15조 제1항" 등 → JO 6자리 문자열 */
function parseArticleToJO(article: string): string | null {
  // 제N조 or 제N조의M
  const m = article.match(/제\s*(\d+)\s*조(?:의\s*(\d+))?/);
  if (!m) return null;
  const main = parseInt(m[1], 10);
  const sub = m[2] ? parseInt(m[2], 10) : 0;
  if (isNaN(main) || main < 1 || main > 9999) return null;
  const jo = String(main).padStart(4, "0") + String(sub).padStart(2, "0");
  return jo;
}

function mockSearch(query: string): LawSearchItem[] {
  const known = [
    "민법",
    "형법",
    "상법",
    "근로기준법",
    "개인정보 보호법",
    "저작권법",
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
} {
  // mock에서는 극단적으로 큰 조문 번호만 실패 처리
  const m = articleStr.match(/제\s*(\d+)\s*조/);
  if (m && parseInt(m[1], 10) > 2000) {
    return {
      exists: false,
      detail: `mock: ${articleStr} 은(는) 존재하지 않는 조문으로 간주합니다.`,
    };
  }
  return { exists: true };
}
