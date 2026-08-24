import type { Metadata } from "next";

import Breadcrumb from "@/components/site/Breadcrumb";
import PageHero from "@/components/site/PageHero";

export const metadata: Metadata = {
  title: "웹사이트 이용약관",
  description: "이츠바이오 웹사이트와 제품 정보, 견적 문의 서비스 이용 조건을 안내합니다.",
};

const terms = [
  ["1. 목적", "이 약관은 주식회사 이츠바이오(이하 ‘회사’)가 운영하는 웹사이트에서 제공하는 제품 정보, 검색, 견적 및 문의 서비스의 이용 조건을 정하는 것을 목적으로 합니다."],
  ["2. 제공 정보의 성격", "웹사이트의 제품 설명, 이미지, 사양, 문서 및 재고·납기 안내는 연구 및 구매 검토를 위한 일반 정보입니다. 제조사의 변경, 데이터 갱신 시점 또는 표시 오류에 따라 실제 공급 조건과 다를 수 있으며, 최종 사양과 공급 조건은 회사가 별도로 제공하는 견적서와 확인 내용이 우선합니다."],
  ["3. 견적과 계약", "웹사이트를 통한 견적 요청은 구매 계약의 청약 또는 승낙으로 보지 않습니다. 가격, 세금, 배송비, 납기, 결제 조건 및 제품의 사용 조건은 회사가 발행한 최종 견적서와 당사자 간 합의에 따릅니다."],
  ["4. 연구용 제품", "별도 표시가 없는 생명과학 제품은 연구용으로 제공되며 인체 또는 동물에 대한 진단·치료 등 승인되지 않은 용도로 사용할 수 없습니다. 이용자는 제품 문서, 안전 지침, 관계 법령과 기관의 연구윤리 및 생물안전 기준을 준수해야 합니다."],
  ["5. 이용자의 의무", "이용자는 정확한 문의 정보를 제공하고 웹사이트, 서버 또는 다른 이용자에게 피해를 주는 자동화 접근, 보안 우회, 허위 문의, 악성 코드 전송, 콘텐츠 무단 복제와 재판매 등의 행위를 해서는 안 됩니다."],
  ["6. 지식재산권", "웹사이트의 구성, 자체 제작 문구, 디자인과 자료에 대한 권리는 회사 또는 정당한 권리자에게 있습니다. 제조사 로고, 상표, 제품 이미지와 문서는 각 권리자에게 귀속되며, 사전 허가 없이 상업적으로 복제·배포할 수 없습니다."],
  ["7. 외부 자료와 링크", "제품 문서 또는 참고 자료가 외부 사이트와 연결될 수 있습니다. 회사는 연결된 외부 서비스의 운영이나 내용 전체를 통제하지 않으며, 외부 서비스에는 해당 운영자의 정책과 조건이 적용됩니다."],
  ["8. 서비스 변경 및 중단", "회사는 데이터 갱신, 점검, 보안 대응 또는 불가항력 사유로 서비스의 일부를 변경하거나 일시 중단할 수 있습니다. 중요한 변경은 가능한 범위에서 웹사이트를 통해 안내합니다."],
  ["9. 책임의 범위", "회사는 고의 또는 중대한 과실이 없는 한 웹사이트의 일반 정보를 최종 실험·구매 판단의 유일한 근거로 사용하여 발생한 간접 손해에 대해 책임을 지지 않습니다. 관계 법령상 제한할 수 없는 책임은 이 조항의 적용을 받지 않습니다."],
  ["10. 개인정보", "문의 과정에서 처리되는 개인정보에는 개인정보처리방침이 적용됩니다."],
  ["11. 준거법과 분쟁", "이 약관은 대한민국 법령에 따라 해석합니다. 분쟁이 발생한 경우 당사자는 원만한 해결을 위해 협의하며, 해결되지 않는 경우 민사소송법상 관할 법원에 따릅니다."],
];

export default function TermsPage() {
  return (
    <main className="bg-white">
      <PageHero eyebrow="TERMS" title="웹사이트 이용약관" description="제품 정보와 견적 문의 서비스를 이용하기 전에 적용되는 기본 조건을 안내합니다." variant="about" />
      <div className="mx-auto max-w-5xl px-6">
        <div className="mt-6 flex justify-end"><Breadcrumb /></div>
        <article className="py-10 md:py-14">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm leading-7 text-slate-700 md:p-8">
            <p>본 약관은 이츠바이오 웹사이트 방문과 문의 서비스 이용에 적용됩니다.</p>
            <p className="mt-2 font-medium text-slate-900">시행일: 2026년 8월 24일</p>
          </div>
          <div className="mt-8 space-y-8">
            {terms.map(([title, body]) => (
              <section key={title}>
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-700">{body}</p>
              </section>
            ))}
          </div>
          <div className="mt-10 rounded-3xl bg-[#071d43] p-6 text-sm leading-7 text-white/75 md:p-8">
            약관 관련 문의: <a href="mailto:info@itsbio.co.kr" className="font-medium text-white underline underline-offset-4">info@itsbio.co.kr</a> · <a href="tel:0234628658" className="font-medium text-white underline underline-offset-4">02-3462-8658</a>
          </div>
        </article>
      </div>
    </main>
  );
}
