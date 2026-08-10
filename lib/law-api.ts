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
