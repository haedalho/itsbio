#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const strict = process.argv.includes("--strict");
const findings = [];

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function read(file) {
  try {
    return fs.readFileSync(path.join(root, file), "utf8");
  } catch {
    return "";
  }
}

function add(level, title, detail, file = "") {
  findings.push({ level, title, detail, file });
}

function semverTuple(input) {
  const match = String(input || "").match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : null;
}

function below(actual, minimum) {
  const a = semverTuple(actual);
  const b = semverTuple(minimum);
  if (!a || !b) return true;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

const pkg = JSON.parse(read("package.json") || "{}");
let lock = {};
try {
  lock = JSON.parse(read("package-lock.json") || "{}");
} catch {}

const nextDeclared = pkg?.dependencies?.next || "";
const nextResolved = lock?.packages?.["node_modules/next"]?.version || "";
if (!nextResolved || below(nextResolved, "16.2.11")) {
  add(
    "P0",
    "Next.js 보안 패치 확인 필요",
    `resolved=${nextResolved || "unknown"}, declared=${nextDeclared || "unknown"}. 16.2.11 이상으로 고정하고 lockfile을 갱신해야 합니다.`,
    "package.json",
  );
}
if (pkg?.devDependencies?.["eslint-config-next"] !== nextDeclared) {
  add(
    "P1",
    "Next.js와 eslint-config-next 버전 불일치",
    `next=${nextDeclared || "unknown"}, eslint-config-next=${pkg?.devDependencies?.["eslint-config-next"] || "unknown"}`,
    "package.json",
  );
}

const requiredPublicFiles = [
  ["app/privacy/page.tsx", "P0", "개인정보 처리방침 페이지 없음"],
  ["app/terms/page.tsx", "P1", "이용약관 페이지 없음"],
  ["app/robots.ts", "P1", "robots.txt 생성 파일 없음"],
  ["app/sitemap.ts", "P1", "sitemap.xml 생성 파일 없음"],
  ["app/not-found.tsx", "P1", "사용자용 404 페이지 없음"],
  ["app/error.tsx", "P1", "사용자용 오류 경계 페이지 없음"],
  [".github/workflows/ci.yml", "P1", "자동 빌드·감사 CI 없음"],
];
for (const [file, level, title] of requiredPublicFiles) {
  if (!exists(file)) add(level, title, `출시 전에 ${file}을 추가해야 합니다.`, file);
}

const nextConfig = read("next.config.ts") || read("next.config.js");
if (!/async\s+headers\s*\(|headers\s*:\s*async/i.test(nextConfig)) {
  add(
    "P0",
    "보안 응답 헤더 없음",
    "CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame-ancestors 정책을 추가해야 합니다.",
    "next.config.ts",
  );
}

const quoteApi = read("app/api/quote/route.ts");
if (quoteApi) {
  if (!/zod|safeParse|schema/i.test(quoteApi)) {
    add("P0", "견적 API 서버 검증 부족", "이메일 형식, 문자열 길이, 허용 필드와 공백 입력을 서버에서 검증해야 합니다.", "app/api/quote/route.ts");
  }
  if (!/turnstile|captcha|honeypot|rate.?limit/i.test(quoteApi)) {
    add("P0", "견적 API 스팸·남용 방어 없음", "봇 방지와 Vercel WAF rate limit을 함께 적용해야 합니다.", "app/api/quote/route.ts");
  }
  if (/Missing RESEND_API_KEY|Missing QUOTE_TO_EMAIL|error\.message/i.test(quoteApi)) {
    add("P0", "견적 API 내부 오류 노출", "환경 변수 이름과 외부 서비스 오류를 사용자에게 그대로 반환하지 말고 일반 오류 문구만 반환해야 합니다.", "app/api/quote/route.ts");
  }
  if (/onboarding@resend\.dev/i.test(quoteApi)) {
    add("P0", "견적 메일 테스트 발신자 사용", "운영 도메인의 SPF/DKIM 인증 발신 주소로 교체해야 합니다.", "app/api/quote/route.ts");
  }
}

const publicWriteFiles = [
  "app/search/page.tsx",
  "app/products/abm/item/[...slug]/page.tsx",
];
for (const file of publicWriteFiles) {
  const source = read(file);
  if (/sanityWriteClient|SANITY_WRITE_TOKEN/i.test(source)) {
    add(
      "P0",
      "공개 페이지 요청이 Sanity 쓰기 권한 사용",
      "검색·상품 조회는 읽기 전용이어야 합니다. 수집과 enrich는 관리자 스크립트나 보호된 작업으로 분리해야 합니다.",
      file,
    );
  }
}

const searchPage = read("app/search/page.tsx");
if (/const\s+BRAND_KEY\s*=\s*["']abm["']/i.test(searchPage)) {
  add("P1", "통합 검색이 ABM에 고정", "Kent와 ABM을 동일한 내부 검색 인덱스에서 조회하도록 통합해야 합니다.", "app/search/page.tsx");
}
if (/redirect\(searchUrl\)|redirect\(productUrl\)/i.test(searchPage)) {
  add("P1", "검색 실패 시 공급사 외부 사이트로 이탈", "검색 결과가 없을 때 내부 문의·대체 검색 결과를 제공해야 합니다.", "app/search/page.tsx");
}

const kentTabs = read("components/products/KentProductTabs.tsx");
if (/dangerouslySetInnerHTML/i.test(kentTabs) && !/sanitize-html|DOMPurify|HtmlContent/i.test(kentTabs)) {
  add("P0", "Kent HTML 직접 렌더링", "원본 HTML을 allowlist 방식으로 정화한 뒤 렌더해야 XSS를 막을 수 있습니다.", "components/products/KentProductTabs.tsx");
}

const htmlContent = read("components/site/HtmlContent.tsx");
if (/dangerouslySetInnerHTML/i.test(htmlContent) && !/sanitize-html|DOMPurify/i.test(htmlContent)) {
  add("P0", "공급사 HTML 정화가 차단목록 방식", "script 태그 제거만으로는 부족합니다. 허용 태그·속성·URL 프로토콜 기반 정화가 필요합니다.", "components/site/HtmlContent.tsx");
}
if (/setRenderHtml\(fallback\)/i.test(htmlContent)) {
  add("P0", "HTML 정화 실패 시 원문 fallback", "정화 실패 시 원문을 표시하지 말고 콘텐츠를 숨기거나 안전한 텍스트만 표시해야 합니다.", "components/site/HtmlContent.tsx");
}

const productsPage = read("app/products/page.tsx");
if (/href=\{`\/products\/\$\{p\.slug\}`\}/.test(productsPage)) {
  add("P0", "상품 카드가 브랜드 없는 상세 경로 사용", "ABM/Kent 표준 경로인 /products/{brand}/item/{slug}로 통일해야 합니다.", "app/products/page.tsx");
}
if (/kentscientifics/i.test(productsPage)) {
  add("P0", "Kent 브랜드 키 불일치", "실제 brand key인 kent로 통일해야 필터와 상세 링크가 정상 작동합니다.", "app/products/page.tsx");
}
if (/productCategory|shortDescription|thumbnail|attachments/i.test(productsPage)) {
  add("P0", "상품 목록과 현재 Sanity 스키마 불일치 가능성", "product schema의 brand reference, summary, categoryPath, images, docs 필드에 맞춰 쿼리를 재작성해야 합니다.", "app/products/page.tsx");
}

const layout = read("app/layout.tsx");
if (/description:\s*["']ITS BIO website["']/i.test(layout) || !/metadataBase|openGraph|twitter/i.test(layout)) {
  add("P1", "사이트 메타데이터가 운영 수준이 아님", "metadataBase, 제목 템플릿, 설명, canonical, Open Graph와 아이콘을 구성해야 합니다.", "app/layout.tsx");
}

const needAssistance = read("components/site/NeedAssistance.tsx");
if (/For now this opens your email app|mailto/i.test(needAssistance)) {
  add("P1", "하단 문의 폼이 임시 mailto 방식", "견적 API 기반 단일 문의 흐름으로 통합하고 개인정보 동의를 받아야 합니다.", "components/site/NeedAssistance.tsx");
}

const kentDetail = read("components/products/KentProductDetailClient.tsx");
if (/Login to see prices/i.test(kentDetail)) {
  add("P1", "Kent 원본 쇼핑몰 문구 잔존", "Login to see prices를 제거하고 ITS BIO 견적 문의만 남겨야 합니다.", "components/products/KentProductDetailClient.tsx");
}

if (/NeedAssistance/.test(layout)) {
  const duplicatedPages = ["app/products/page.tsx", "app/promotions/page.tsx"].filter((file) => /NeedAssistance/.test(read(file)));
  if (duplicatedPages.length) {
    add("P1", "NeedAssistance 중복 렌더 가능성", `RootLayout과 ${duplicatedPages.join(", ")}에서 동시에 렌더합니다.`, "app/layout.tsx");
  }
}

const priorities = ["P0", "P1", "P2"];
console.log("\n=== ITS BIO production readiness audit ===\n");
for (const level of priorities) {
  const rows = findings.filter((item) => item.level === level);
  console.log(`${level}: ${rows.length}`);
  for (const [index, item] of rows.entries()) {
    console.log(`  ${index + 1}. ${item.title}`);
    console.log(`     ${item.detail}`);
    if (item.file) console.log(`     file: ${item.file}`);
  }
  console.log("");
}

console.log("P0는 공개 배포 전에 반드시 해결해야 합니다.");
console.log("P1은 정식 도메인 공개 전 최소 완성 항목입니다.\n");

if (strict && findings.some((item) => item.level === "P0")) process.exitCode = 1;
