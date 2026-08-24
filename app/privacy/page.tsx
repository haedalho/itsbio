import type { Metadata } from "next";
import Link from "next/link";

import Breadcrumb from "@/components/site/Breadcrumb";
import PageHero from "@/components/site/PageHero";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "이츠바이오 웹사이트의 개인정보 처리 목적, 항목, 보유기간 및 정보주체의 권리를 안내합니다.",
};

const sections = [
  {
    title: "1. 개인정보의 처리 목적",
    body: "이츠바이오(이하 ‘회사’)는 견적 요청, 제품 문의, 재고·납기 확인, 기술 및 고객 지원, 문의 이력 관리와 분쟁 대응을 위해 필요한 범위에서 개인정보를 처리합니다. 수집한 정보는 안내한 목적 외의 용도로 사용하지 않습니다.",
  },
  {
    title: "2. 처리하는 개인정보 항목",
    body: "필수 항목은 이메일 주소와 문의 내용입니다. 이름, 회사·연구실, 전화번호, 부서, 연구 분야, 문의 유형, 제품명·카탈로그 번호는 이용자가 선택하여 입력할 수 있습니다. 문의 과정에서 접속 기록과 요청 시각 등 최소한의 기술 정보가 보안 및 오남용 방지를 위해 처리될 수 있습니다.",
  },
  {
    title: "3. 처리 및 보유 기간",
    body: "문의 및 견적 관련 정보는 문의 처리와 후속 대응을 위해 처리 완료일부터 3년간 보관한 후 지체 없이 파기합니다. 다만 관계 법령에 별도의 보존 의무가 있거나 분쟁 해결을 위해 필요한 경우에는 해당 기간 동안 보관할 수 있습니다.",
  },
  {
    title: "4. 개인정보의 제3자 제공",
    body: "회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 법령에 근거가 있거나 이용자가 별도로 동의한 경우에만 필요한 범위에서 제공합니다.",
  },
  {
    title: "5. 처리 업무의 위탁 및 국외 이전",
    body: "회사는 웹 문의 이메일 전송을 위해 Resend, Inc.의 이메일 전송 서비스를 이용합니다. 이용자가 전송 버튼을 누를 때 입력 정보가 암호화된 네트워크를 통해 미국 소재 서비스로 전송되어 회사의 문의 수신 이메일로 전달될 수 있습니다. 위탁 목적은 이메일 전송과 전송 오류 확인이며, 해당 사업자의 보관 및 보호 정책이 적용됩니다. 국외 이전을 원하지 않는 경우 웹 양식 대신 전화(02-3462-8658)로 문의할 수 있습니다.",
  },
  {
    title: "6. 개인정보의 파기",
    body: "보유 기간이 끝나거나 처리 목적이 달성된 개인정보는 복구 또는 재생되지 않도록 안전한 방법으로 파기합니다. 전자 파일은 복구가 어려운 방식으로 삭제하고, 출력물은 분쇄 또는 소각합니다.",
  },
  {
    title: "7. 정보주체의 권리",
    body: "이용자는 자신의 개인정보에 대해 열람, 정정·삭제, 처리정지 또는 동의 철회를 요청할 수 있습니다. 아래 연락처로 요청하면 본인 확인 후 관련 법령에 따라 지체 없이 처리합니다.",
  },
  {
    title: "8. 안전성 확보 조치",
    body: "회사는 개인정보 접근 권한 최소화, 전송 구간 암호화, 접근 기록 관리, 보안 업데이트 및 내부 관리 절차 등 개인정보 보호에 필요한 기술적·관리적 조치를 시행합니다.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="bg-white">
      <PageHero eyebrow="PRIVACY" title="개인정보처리방침" description="이츠바이오는 문의 과정에서 제공되는 개인정보를 필요한 범위에서 안전하게 처리합니다." variant="about" />
      <div className="mx-auto max-w-5xl px-6">
        <div className="mt-6 flex justify-end"><Breadcrumb /></div>
        <article className="py-10 md:py-14">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm leading-7 text-slate-700 md:p-8">
            <p>주식회사 이츠바이오는 「개인정보 보호법」 제30조에 따라 이용자의 개인정보를 보호하고 관련 고충을 처리하기 위해 다음과 같이 개인정보처리방침을 공개합니다.</p>
            <p className="mt-2 font-medium text-slate-900">시행일: 2026년 8월 24일</p>
          </div>

          <div className="mt-8 space-y-8">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">{section.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-700">{section.body}</p>
              </section>
            ))}

            <section className="rounded-3xl bg-[#071d43] p-6 text-white md:p-8">
              <h2 className="text-xl font-semibold">9. 개인정보 보호책임자 및 문의처</h2>
              <dl className="mt-4 grid gap-2 text-sm leading-6 text-white/75 sm:grid-cols-[150px_1fr]">
                <dt className="font-semibold text-white">담당 부서</dt><dd>이츠바이오 고객지원</dd>
                <dt className="font-semibold text-white">이메일</dt><dd><a href="mailto:info@itsbio.co.kr" className="underline underline-offset-4">info@itsbio.co.kr</a></dd>
                <dt className="font-semibold text-white">전화</dt><dd><a href="tel:0234628658" className="underline underline-offset-4">02-3462-8658</a></dd>
                <dt className="font-semibold text-white">주소</dt><dd>서울특별시 강서구 양천로 551-17 한화비즈메트로 A동 812호</dd>
              </dl>
            </section>

            <section>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">10. 방침의 변경</h2>
              <p className="mt-3 text-sm leading-7 text-slate-700">이 방침이 변경되는 경우 시행 전에 웹사이트 공지사항을 통해 안내합니다. 서비스 이용 조건은 <Link href="/terms" className="font-medium text-orange-700 underline underline-offset-2">이용약관</Link>에서 확인할 수 있습니다.</p>
            </section>
          </div>
        </article>
      </div>
    </main>
  );
}
