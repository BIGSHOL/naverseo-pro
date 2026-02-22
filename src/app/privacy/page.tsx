import Link from 'next/link'
import { Navbar } from '@/components/landing/navbar'
import { Footer } from '@/components/landing/footer'

export const metadata = {
  title: '개인정보처리방침 | NaverSEO Pro',
  description: 'NaverSEO Pro 개인정보처리방침',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <h1 className="mb-4 text-3xl font-bold">개인정보처리방침</h1>
        <p className="mb-8 text-muted-foreground">
          NaverSEO Pro의 개인정보 처리방침입니다.
        </p>

        <div className="mb-10 rounded-lg border bg-muted/30 p-6 text-sm leading-relaxed text-muted-foreground">
          <p>
            NaverSEO Pro(이하 &quot;회사&quot;)은(는) 「개인정보보호법」 제30조에 따라
            정보주체의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록
            하기 위하여 다음과 같이 개인정보 처리방침을 수립·공개합니다.
          </p>
          <p className="mt-3">
            이 개인정보처리방침은 2026년 2월 19일부터 적용됩니다.
          </p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed text-muted-foreground">
          {/* 제1조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제1조 (개인정보의 처리 목적)</h2>
            <p className="mb-3">
              회사는 다음의 목적을 위하여 개인정보를 처리합니다.
              처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며
              이용 목적이 변경되는 경우에는 「개인정보 보호법」 제18조에 따라
              별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
            </p>
            <ol className="list-decimal space-y-3 pl-6">
              <li>
                <span className="font-medium text-foreground">홈페이지 회원가입 및 관리</span>
                <br />
                회원제 서비스 제공에 따른 본인 식별·인증, 회원자격 유지·관리, 서비스 이용량 관리 목적으로 개인정보를 처리합니다.
              </li>
              <li>
                <span className="font-medium text-foreground">서비스 제공</span>
                <br />
                키워드 검색량 조회, AI 블로그 콘텐츠 생성, SEO 점수 분석, 블로그 순위 트래킹 등
                핵심 기능 제공을 목적으로 개인정보를 처리합니다.
              </li>
              <li>
                <span className="font-medium text-foreground">요금 결제</span>
                <br />
                유료 플랜(Lite, Starter, Pro, Business, Agency) 서비스 이용 시 결제 처리를 목적으로 개인정보를 처리합니다.
              </li>
              <li>
                <span className="font-medium text-foreground">마케팅 및 서비스 개선</span>
                <br />
                접속빈도 파악, 회원의 서비스 이용에 대한 통계, 서비스 업데이트 안내 등을 목적으로 개인정보를 처리합니다.
              </li>
            </ol>
          </section>

          {/* 제2조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제2조 (개인정보의 처리 및 보유 기간)</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.</li>
              <li>
                각각의 개인정보 처리 및 보유 기간은 다음과 같습니다.
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>
                    <span className="font-medium text-foreground">회원가입 및 관리:</span> 회원 탈퇴 시까지
                    (탈퇴 후 지체없이 파기, 단 아래 법령에 따른 보존 의무 제외)
                  </li>
                  <li>
                    <span className="font-medium text-foreground">전자상거래법에 따른 거래 기록:</span> 5년
                  </li>
                  <li>
                    <span className="font-medium text-foreground">전자상거래법에 따른 소비자 불만·분쟁 처리 기록:</span> 3년
                  </li>
                  <li>
                    <span className="font-medium text-foreground">통신비밀보호법에 따른 접속 기록:</span> 3개월
                  </li>
                </ul>
              </li>
            </ol>
          </section>

          {/* 제3조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제3조 (처리하는 개인정보의 항목)</h2>
            <p className="mb-3">회사는 다음의 개인정보 항목을 처리하고 있습니다.</p>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-foreground">1. 회원가입 및 관리</h3>
                <ul className="mt-1 list-disc space-y-1 pl-6">
                  <li><span className="font-medium">필수항목:</span> 이메일 주소, 비밀번호(암호화 저장)</li>
                  <li><span className="font-medium">자동수집:</span> 서비스 이용 기록, 접속 로그, 쿠키, 접속 IP 정보</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-foreground">2. 서비스 이용</h3>
                <ul className="mt-1 list-disc space-y-1 pl-6">
                  <li>키워드 검색 이력, AI 콘텐츠 생성 이력, SEO 분석 이력</li>
                  <li>블로그 URL(순위 트래킹 시)</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-foreground">3. 유료 결제</h3>
                <ul className="mt-1 list-disc space-y-1 pl-6">
                  <li>결제 수단 정보(토스페이먼츠를 통해 처리, 회사가 카드번호를 직접 저장하지 않음)</li>
                  <li>결제 내역(주문번호, 결제금액, 결제일시)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 제4조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제4조 (개인정보의 제3자 제공에 관한 사항)</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>회사는 개인정보를 제1조(개인정보의 처리 목적)에서 명시한 범위 내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등 「개인정보 보호법」 제17조 및 제18조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다.</li>
              <li>회사는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 다만, 이용자가 사전에 동의한 경우 또는 법령에 의하여 요구되는 경우에는 예외로 합니다.</li>
            </ol>
          </section>

          {/* 제5조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제5조 (개인정보처리의 위탁에 관한 사항)</h2>
            <p className="mb-3">회사는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보 처리업무를 위탁하고 있습니다.</p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="py-2.5 px-3 text-left font-medium text-foreground">수탁업체</th>
                    <th className="py-2.5 px-3 text-left font-medium text-foreground">위탁 업무</th>
                    <th className="py-2.5 px-3 text-left font-medium text-foreground">보유 기간</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2.5 px-3">Supabase Inc.</td>
                    <td className="py-2.5 px-3">데이터베이스 호스팅, 사용자 인증(Auth) 서비스</td>
                    <td className="py-2.5 px-3">위탁계약 종료 시</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2.5 px-3">Vercel Inc.</td>
                    <td className="py-2.5 px-3">웹 서비스 호스팅 및 배포</td>
                    <td className="py-2.5 px-3">위탁계약 종료 시</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2.5 px-3">주식회사 토스페이먼츠</td>
                    <td className="py-2.5 px-3">결제 처리 및 결제 정보 관리</td>
                    <td className="py-2.5 px-3">위탁계약 종료 시</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2.5 px-3">Google LLC (Gemini API)</td>
                    <td className="py-2.5 px-3">AI 콘텐츠 생성 및 분석 처리</td>
                    <td className="py-2.5 px-3">위탁계약 종료 시</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2.5 px-3">Anthropic PBC (Claude API)</td>
                    <td className="py-2.5 px-3">AI 콘텐츠 생성 및 분석 처리</td>
                    <td className="py-2.5 px-3">위탁계약 종료 시</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 제6조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제6조 (개인정보의 파기절차 및 파기방법)</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.</li>
              <li>정보주체로부터 동의받은 개인정보 보유기간이 경과하거나 처리목적이 달성되었음에도 불구하고 다른 법령에 따라 개인정보를 계속 보존하여야 하는 경우에는, 해당 개인정보를 별도의 데이터베이스(DB)로 옮기거나 보관장소를 달리하여 보존합니다.</li>
              <li>
                개인정보 파기의 절차 및 방법은 다음과 같습니다.
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li><span className="font-medium">파기절차:</span> 회사는 파기 사유가 발생한 개인정보를 선정하고, 개인정보 보호책임자의 승인을 받아 개인정보를 파기합니다.</li>
                  <li><span className="font-medium">파기방법:</span> 전자적 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법(데이터베이스 삭제)을 사용하여 파기합니다.</li>
                </ul>
              </li>
            </ol>
          </section>

          {/* 제7조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제7조 (정보주체와 법정대리인의 권리·의무 및 그 행사방법)</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>정보주체는 회사에 대해 언제든지 개인정보 열람·정정·삭제·처리정지 요구 등의 권리를 행사할 수 있습니다.</li>
              <li>제1항에 따른 권리 행사는 회사에 대해 「개인정보 보호법」 시행령 제41조 제1항에 따라 서면, 전자우편 등을 통하여 하실 수 있으며 회사는 이에 대해 지체 없이 조치하겠습니다.</li>
              <li>제1항에 따른 권리 행사는 정보주체의 법정대리인이나 위임을 받은 자 등 대리인을 통하여 하실 수 있습니다. 이 경우 &quot;개인정보 처리 방법에 관한 고시(제2020-7호)&quot; 별지 제11호 서식에 따른 위임장을 제출하셔야 합니다.</li>
              <li>개인정보 열람 및 처리정지 요구는 「개인정보 보호법」 제35조 제4항, 제37조 제2항에 의하여 정보주체의 권리가 제한될 수 있습니다.</li>
              <li>개인정보의 정정 및 삭제 요구는 다른 법령에서 그 개인정보가 수집 대상으로 명시되어 있는 경우에는 그 삭제를 요구할 수 없습니다.</li>
              <li>회사는 정보주체 권리에 따른 열람의 요구, 정정·삭제의 요구, 처리정지의 요구 시 열람 등 요구를 한 자가 본인이거나 정당한 대리인인지를 확인합니다.</li>
            </ol>
          </section>

          {/* 제8조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제8조 (개인정보의 안전성 확보조치에 관한 사항)</h2>
            <p className="mb-3">회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.</p>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                <span className="font-medium text-foreground">개인정보의 암호화</span>
                <br />
                이용자의 비밀번호는 Supabase Auth를 통해 암호화되어 저장 및 관리되고 있으며,
                중요한 데이터는 SSL/TLS 암호화 통신을 통해 전송됩니다.
              </li>
              <li>
                <span className="font-medium text-foreground">데이터 접근 제어</span>
                <br />
                Supabase Row Level Security(RLS)를 적용하여 각 회원은 본인의 데이터에만 접근할 수 있도록
                데이터베이스 수준에서 접근을 제어하고 있습니다.
              </li>
              <li>
                <span className="font-medium text-foreground">접속기록의 보관 및 위변조 방지</span>
                <br />
                개인정보처리시스템에 접속한 기록을 최소 3개월 이상 보관·관리하고 있으며,
                접속기록이 위변조 및 도난, 분실되지 않도록 보안기능을 사용하고 있습니다.
              </li>
              <li>
                <span className="font-medium text-foreground">결제 정보 보안</span>
                <br />
                결제 정보는 토스페이먼츠를 통해 안전하게 처리되며, 회사가 카드번호 등
                민감한 결제 정보를 직접 저장하지 않습니다.
              </li>
              <li>
                <span className="font-medium text-foreground">정기적인 보안 점검</span>
                <br />
                개인정보 취급 관련 안전성 확보를 위해 정기적으로 보안 점검을 실시하고 있습니다.
              </li>
            </ol>
          </section>

          {/* 제9조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제9조 (개인정보를 자동으로 수집하는 장치의 설치·운영 및 그 거부에 관한 사항)</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>회사는 이용자에게 개별적인 맞춤서비스를 제공하기 위해 이용정보를 저장하고 수시로 불러오는 &apos;쿠키(cookie)&apos;를 사용합니다.</li>
              <li>
                쿠키는 웹사이트를 운영하는데 이용되는 서버(HTTPS)가 이용자의 컴퓨터 브라우저에게 보내는
                소량의 정보이며 이용자의 컴퓨터 내 저장공간에 저장되기도 합니다.
                <ul className="mt-2 list-disc space-y-2 pl-6">
                  <li>
                    <span className="font-medium">쿠키의 사용 목적:</span> 이용자 인증 상태 유지,
                    서비스 이용 패턴 분석, 이용자에게 최적화된 정보 제공을 위해 사용됩니다.
                  </li>
                  <li>
                    <span className="font-medium">쿠키의 설치·운영 및 거부:</span> 웹브라우저 상단의
                    설정 &gt; 개인정보 메뉴에서 쿠키 저장을 거부할 수 있습니다.
                  </li>
                  <li>
                    <span className="font-medium">쿠키 저장 거부 시:</span> 로그인 유지 등 일부 서비스
                    이용에 어려움이 발생할 수 있습니다.
                  </li>
                </ul>
              </li>
            </ol>
          </section>

          {/* 제10조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제10조 (추가적인 이용·제공 판단기준)</h2>
            <p className="mb-3">
              회사는 ｢개인정보 보호법｣ 제15조 제3항 및 제17조 제4항에 따라
              ｢개인정보 보호법 시행령｣ 제14조의2에 따른 사항을 고려하여
              정보주체의 동의 없이 개인정보를 추가적으로 이용·제공할 수 있습니다.
              이에 따라 회사가 정보주체의 동의 없이 추가적인 이용·제공을 하기 위해서
              다음과 같은 사항을 고려합니다.
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li>개인정보를 추가적으로 이용·제공하려는 목적이 당초 수집 목적과 관련성이 있는지 여부</li>
              <li>개인정보를 수집한 정황 또는 처리 관행에 비추어 볼 때 추가적인 이용·제공에 대한 예측 가능성이 있는지 여부</li>
              <li>개인정보의 추가적인 이용·제공이 정보주체의 이익을 부당하게 침해하는지 여부</li>
              <li>가명처리 또는 암호화 등 안전성 확보에 필요한 조치를 하였는지 여부</li>
            </ul>
          </section>

          {/* 제11조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제11조 (개인정보 보호책임자에 관한 사항)</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한
                정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
                <div className="mt-3 rounded border bg-muted/30 p-4">
                  <p className="font-medium text-foreground">개인정보 보호책임자</p>
                  <ul className="mt-2 space-y-1">
                    <li>담당: NaverSEO Pro 운영팀</li>
                    <li>이메일: soseon203@gmail.com</li>
                  </ul>
                </div>
              </li>
              <li>정보주체께서는 회사의 서비스를 이용하시면서 발생한 모든 개인정보 보호 관련 문의, 불만처리, 피해구제 등에 관한 사항을 개인정보 보호책임자에게 문의하실 수 있습니다. 회사는 정보주체의 문의에 대해 지체 없이 답변 및 처리해드릴 것입니다.</li>
            </ol>
          </section>

          {/* 제12조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제12조 (개인정보의 열람청구를 접수·처리하는 부서)</h2>
            <p className="mb-3">
              정보주체는 「개인정보 보호법」 제35조에 따른 개인정보의 열람 청구를
              아래의 부서에 할 수 있습니다. 회사는 정보주체의 개인정보 열람청구가
              신속하게 처리되도록 노력하겠습니다.
            </p>
            <div className="rounded border bg-muted/30 p-4">
              <p className="font-medium text-foreground">개인정보 열람청구 접수·처리 부서</p>
              <ul className="mt-2 space-y-1">
                <li>담당: NaverSEO Pro 운영팀</li>
                <li>이메일: soseon203@gmail.com</li>
              </ul>
            </div>
          </section>

          {/* 제13조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제13조 (정보주체의 권익침해에 대한 구제방법)</h2>
            <p className="mb-3">
              정보주체는 개인정보침해로 인한 구제를 받기 위하여 개인정보분쟁조정위원회,
              한국인터넷진흥원 개인정보침해신고센터 등에 분쟁해결이나 상담 등을 신청할 수 있습니다.
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li>개인정보분쟁조정위원회: (국번없이) 1833-6972 (www.kopico.go.kr)</li>
              <li>개인정보침해신고센터: (국번없이) 118 (privacy.kisa.or.kr)</li>
              <li>대검찰청: (국번없이) 1301 (www.spo.go.kr)</li>
              <li>경찰청: (국번없이) 182 (ecrm.cyber.go.kr)</li>
            </ul>
          </section>

          {/* 제14조 */}
          <section className="border-t pt-8">
            <h2 className="mb-3 text-lg font-semibold text-foreground">제14조 (개인정보 처리방침 변경)</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>이 개인정보처리방침은 2026년 2월 19일부터 적용됩니다.</li>
              <li>이전의 개인정보 처리방침은 아래에서 확인하실 수 있습니다.</li>
            </ol>
            <p className="mt-3 text-xs">(이전 내역 없음)</p>
          </section>
        </div>

        <div className="mt-12 text-center">
          <Link href="/" className="text-sm text-primary hover:underline">
            ← 홈으로 돌아가기
          </Link>
        </div>
      </div>
      <Footer />
    </main>
  )
}