import Link from 'next/link'
import { Navbar } from '@/components/landing/navbar'
import { Footer } from '@/components/landing/footer'

export const metadata = {
  title: '이용약관 | NaverSEO Pro',
  description: 'NaverSEO Pro 서비스 이용약관',
}

export default function TermsPage() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <h1 className="mb-4 text-3xl font-bold">서비스 이용약관</h1>
        <p className="mb-8 text-muted-foreground">
          NaverSEO Pro의 서비스 이용약관입니다.
        </p>

        <div className="mb-10 rounded-lg border bg-muted/30 p-6 text-sm leading-relaxed text-muted-foreground">
          <p className="mb-3">
            본 이용약관의 주요 내용은 NaverSEO Pro(이하 &quot;회사&quot;라 합니다)가 회원의 권익을 위하여,
            &nbsp;『약관의 규제에 관한 법률』 상 의무를 이행하기 위하여 별도로 회원에게 고지하는 것입니다.
          </p>
          <p className="mb-3">
            그러므로, 회원은 본 이용약관의 주요 내용을 반드시 확인하고, 본 이용약관의 주요 내용을
            이해할 수 없거나 의문이 발생하는 경우에는 회사에게 별도로 문의하는 방법 등을 통하여
            이용약관 전체를 숙지하여 주시기 바랍니다.
          </p>
          <p className="mb-3">
            접속자가 회사의 서비스를 이용하기 위하여 회원이 회사에게 제공한 정보와 일치하는 정보를
            기입하여 회사의 웹사이트를 이용하는 경우, 해당 접속 기간 중 이루어지는 모든 행위는
            해당 회원의 진정한 의사에 의한 것으로 간주합니다.
            그러므로 회원은 계정, 비밀번호 기타 정보에 대한 보안을 각별히 유의하셔야 합니다.
          </p>
          <p>
            회사는 365일, 24시간 서비스를 제공하기 위하여 노력하고 있으나, 이를 보증하는 것이 아닙니다.
            시스템 오류, 점검, 외부 API 장애 등으로 서비스가 일시 중단될 수 있으며,
            회사는 문제 해결 후 서비스를 재개합니다.
          </p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed text-muted-foreground">
          {/* 제1조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제1조 (목적)</h2>
            <p>
              이 약관은 회사가 제공하는 NaverSEO Pro 서비스(이하 &quot;서비스&quot;)와 관련된
              회사와 회원의 권리, 의무 및 책임사항 등 필요한 사항을 규정하기 위함을 목적으로 합니다.
            </p>
          </section>

          {/* 제2조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제2조 (정의)</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>&quot;서비스&quot;란 NaverSEO Pro가 제공하는 네이버 키워드 검색량 조회, AI 블로그 콘텐츠 생성, SEO 점수 분석, 블로그 순위 트래킹 등 모든 온라인 서비스를 의미합니다.</li>
              <li>&quot;회원&quot;이란 본 약관에 동의하고 서비스에 가입하여 계정을 부여받은 자를 의미합니다.</li>
              <li>&quot;비회원&quot;이란 회원가입 없이 서비스의 일부 기능(랜딩 페이지 열람 등)을 이용하는 자를 의미합니다.</li>
              <li>&quot;유료 플랜&quot;이란 Lite, Starter, Pro, Enterprise 등 월정액 요금을 지불하고 이용하는 서비스를 의미합니다.</li>
              <li>&quot;콘텐츠&quot;란 서비스를 통해 AI가 생성한 블로그 글, 분석 결과, 키워드 데이터 등 일체의 정보를 의미합니다.</li>
            </ol>
          </section>

          {/* 제3조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제3조 (약관의 명시, 설명과 개정)</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>이 약관의 내용은 회사가 제공하는 NaverSEO Pro 웹사이트에 게시하거나 기타의 방법으로 이용자에게 공지하고, 이용자가 회원으로 가입하면서 이 약관에 동의함으로써 효력을 발생합니다.</li>
              <li>
                회사는 필요한 경우 관련 법령에 위배되지 않는 범위 내에서 이 약관의 내용을 변경할 수 있습니다.
                이 약관이 변경되는 경우 회사는 변경사항을 개정 약관의 시행일자 7일 전부터 제1항의 방법으로 공지합니다.
                다만, 회원에게 불리하게 약관내용을 변경하는 경우에는 최소한 30일 이상의 사전 유예기간을 두고 공지합니다.
                이 경우 회사는 개정 전 내용과 개정 후 내용을 명확하게 비교하여 회원이 알기 쉽도록 표시합니다.
              </li>
              <li>
                회사가 제2항에 따라 약관의 개정을 공지함과 동시에 공지일로부터 개정약관 시행일 7일 후까지
                회원이 개정약관의 적용에 동의하지 않는다는 의사를 표시하지 아니하면 개정약관의 적용에 동의한 것으로
                본다는 뜻을 명확하게 고지하였음에도 불구하고 회원의 명시적인 부동의 의사가 없는 경우에는
                개정약관의 적용을 승인한 것으로 간주합니다.
                회원이 개정약관의 적용에 동의하지 않는다는 명시적 의사를 표명한 경우 회원은 이용계약을 해지할 수 있습니다.
              </li>
            </ol>
          </section>

          {/* 제4조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제4조 (약관 외 준칙)</h2>
            <p>
              이 약관에서 정하지 아니한 사항과 이 약관의 해석에 관하여는
              &nbsp;『전자상거래 등에서의 소비자보호에 관한 법률』, 『약관의 규제에 관한 법률』,
              공정거래위원회가 제정한 『전자상거래 등에서의 소비자보호지침』 및 관련 법령의 규정과
              일반 상관례에 의합니다.
            </p>
          </section>

          {/* 제5조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제5조 (서비스의 제공 및 변경)</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>회사는 다음과 같은 서비스를 제공합니다.
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>네이버 키워드 검색량 조회 및 분석</li>
                  <li>AI 기반 블로그 콘텐츠 생성</li>
                  <li>블로그 글 SEO 점수 분석</li>
                  <li>네이버 블로그 순위 트래킹</li>
                  <li>기타 회사가 정하는 부가 서비스</li>
                </ul>
              </li>
              <li>회사는 서비스의 종류에 따라 각 서비스의 특성, 절차 및 방법에 대한 사항을 서비스 화면을 통하여 공지하며, 회원은 회사가 공지한 각 서비스에 관한 사항을 이해하고 서비스를 이용하여야 합니다.</li>
              <li>회사는 서비스 내용이 변경되는 경우, 변경이 예정된 날로부터 적어도 7일 이전에 이를 통지하여야 하며, 회원이 공지 내용을 조회하지 않아 발생하게 되는 손해에 관하여 책임지지 않습니다.</li>
            </ol>
          </section>

          {/* 제6조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제6조 (서비스 이용의 개시 및 제한)</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                이용자는 회사가 정한 가입 양식에 따라 이메일 또는 소셜 로그인(Google, Kakao)을 통해
                회원가입을 하여 서비스를 이용할 수 있습니다.
                다만, 아래의 경우에는 서비스 전부 또는 일부의 이용에 제한이 있을 수 있습니다.
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>다른 사람의 개인정보를 이용하여 서비스를 이용하려 하는 경우</li>
                  <li>서비스 이용 과정에서 허위의 정보를 입력하는 경우</li>
                  <li>관련 법령에 위반되는 목적으로 서비스를 이용하는 경우</li>
                  <li>서비스의 정상적 운영을 방해하는 행위를 하는 경우</li>
                </ul>
              </li>
              <li>회원이 제1항 각호의 어느 하나에 위반하여 서비스를 이용한 것으로 판명된 때에는 회사는 즉시 회원의 서비스 이용을 중단하거나 회원의 계정을 삭제하는 등 적절한 제한을 할 수 있습니다.</li>
            </ol>
          </section>

          {/* 제7조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제7조 (계정의 관리)</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                계정은 회원 본인만 이용할 수 있고, 어떠한 경우에도 다른 사람이 회원의 계정을 이용하도록
                허락할 수 없습니다. 회원은 다른 사람이 회원의 계정을 무단으로 사용할 수 없도록
                비밀번호를 관리하여야 합니다.
                회원이 무단 사용을 발견하는 즉시, 회사에게 이를 통지하여야 하고, 회사는 즉시 계정의
                이용중단 등의 조치를 취할 수 있습니다.
              </li>
              <li>
                회원은 서비스 내 설정 화면을 통하여 회원의 정보를 열람하고 수정할 수 있습니다.
                다만, 서비스의 제공 및 관리를 위해 필요한 일부 정보는 수정이 불가능할 수 있습니다.
              </li>
              <li>회원이 계정 정보를 최신으로 유지하지 아니하여 발생하는 손해 중 회사의 고의 또는 과실로 인하여 발생하지 않은 손해에 대해서는 회사가 책임을 부담하지 않습니다.</li>
              <li>회원이 비밀번호를 도용당하여 제3자가 회원의 계정을 무단으로 사용함으로 인하여 손해가 발생하는 경우, 회사의 고의 또는 과실 없이 발생한 손해에 대해서는 회사가 책임을 부담하지 아니합니다.</li>
            </ol>
          </section>

          {/* 제8조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제8조 (이용 요금 및 결제)</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>서비스는 무료 플랜(Free)과 유료 플랜(Lite, Starter, Pro, Enterprise)을 제공합니다. 각 플랜별 제공 기능 및 이용 한도는 서비스 내 가격 안내 페이지에 명시합니다.</li>
              <li>유료 플랜은 월 단위로 자동 갱신되며, 회원이 해지하지 않는 한 매월 동일한 결제 수단으로 결제됩니다.</li>
              <li>결제는 LemonSqueezy를 통해 처리되며, 회사는 결제 정보를 직접 저장하지 않습니다.</li>
              <li>각 플랜에는 월간 크레딧이 제공되며(Free 30, Lite 100, Starter 250, Pro 600, Enterprise 2,000), 크레딧은 매월 자동 초기화됩니다. 기능별 크레딧 소모량은 서비스 내 안내를 참고하세요.</li>
              <li>플랜 업그레이드 시 즉시 적용되며, 다운그레이드 시 현재 결제 주기가 끝나는 시점에 적용됩니다.</li>
            </ol>
          </section>

          {/* 제9조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제9조 (서비스 이용방법 및 주의사항)</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>회사는 서비스 품질 향상을 위하여 회원에게 서비스 이용과 관련된 각종 고지, 관리 메시지 및 기타 정보를 서비스에 표시하거나 전자우편을 보낼 수 있습니다.</li>
              <li>
                회원은 서비스를 자유롭게 이용할 수 있으나, 아래 각호의 행위는 금지됩니다.
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>회사가 안내하는 방법 이외의 다른 방법(크롤링, 자동화 봇 등)을 이용하여 서비스에 접근하는 행위</li>
                  <li>다른 회원의 정보를 무단으로 수집·이용하는 행위</li>
                  <li>서비스를 통해 얻은 정보를 회사의 동의 없이 상업적으로 재판매하는 행위</li>
                  <li>회사의 동의 없이 서비스 또는 이에 포함된 소프트웨어를 복사·수정·배포·역설계하는 행위</li>
                  <li>AI 콘텐츠 생성 기능을 이용하여 허위 정보, 스팸성 콘텐츠, 법령에 위반되는 콘텐츠를 대량 생산하는 행위</li>
                  <li>계정 정보를 타인에게 대여·양도·담보로 제공하는 행위</li>
                  <li>공서양속 및 법령에 위반되는 내용의 정보를 게시하는 행위</li>
                </ul>
              </li>
              <li>회원이 관련 법령, 회사의 모든 약관 또는 정책을 준수하지 않는다면, 회사는 회원의 위반행위 등을 조사하거나 회원의 서비스 이용을 잠시 또는 계속하여 중단할 수 있고, 회원의 서비스 재가입에 제한을 둘 수 있습니다.</li>
            </ol>
          </section>

          {/* 제10조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제10조 (AI 생성 콘텐츠에 관한 특칙)</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>서비스에서 제공하는 AI 콘텐츠 생성 및 분석 기능은 Google Gemini API, Anthropic Claude API 등을 활용하며, AI가 생성한 콘텐츠의 정확성, 완전성, 적합성을 보장하지 않습니다.</li>
              <li>AI가 생성한 콘텐츠를 블로그에 게시하거나 활용할 경우, 해당 콘텐츠에 대한 법적 책임(저작권, 명예훼손, 허위사실 유포 등)은 이를 게시한 회원에게 있습니다.</li>
              <li>회원은 AI가 생성한 콘텐츠를 반드시 검토·수정한 후 활용하여야 하며, AI 생성 결과물을 무검토로 대량 게시하여 발생하는 문제에 대해 회사는 책임을 부담하지 않습니다.</li>
              <li>회사는 AI 콘텐츠 생성 품질 향상을 위해 회원의 입력 키워드 및 생성 결과를 익명화하여 분석할 수 있습니다.</li>
            </ol>
          </section>

          {/* 제11조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제11조 (서비스의 이용, 변경 및 종료)</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                회사는 서비스를 365일 24시간 제공하기 위하여 최선의 노력을 다합니다.
                다만, 장비의 유지·보수를 위한 정기·임시점검 또는 다른 상당한 이유로 서비스의 제공이 일시 중단될 수 있고,
                이 때에는 사전에 서비스 제공 화면에 공지합니다.
              </li>
              <li>회사가 예측할 수 없는 이유로 서비스가 중단된 때에는 회사가 서비스 중단 사실을 파악하는 즉시 최대한 빠른 시일 내에 서비스를 복구하도록 노력합니다.</li>
              <li>회사는 네이버 검색광고 API, 네이버 데이터랩 API 등 외부 API의 정책 변경, 장애, 서비스 종료로 인해 일부 기능이 변경되거나 제한될 수 있으며, 이 경우 사전 공지합니다.</li>
              <li>회사는 서비스 제공을 위하여 제휴한 회사와의 계약종료, 변경 또는 신규서비스 개시 등의 사유로 서비스의 내용이 변경되거나 서비스가 종료될 수 있습니다.</li>
            </ol>
          </section>

          {/* 제12조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제12조 (이용계약의 해지)</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                회원이 서비스의 이용을 원하지 아니하거나 이 약관에 동의하지 아니하는 경우,
                회원은 언제든지 서비스 내 제공되는 설정 메뉴 또는 이메일(soseon203@gmail.com)을 통하여
                서비스 이용계약의 해지를 신청할 수 있고, 회사는 법령이 정하는 바에 따라 이를 처리합니다.
              </li>
              <li>
                회원이 이 약관상 의무를 포함하여 총 2회 이상 의무를 위반하거나
                서비스의 전부 또는 일부의 중단 또는 이용 제한의 조치가 이루어졌음에도 불구하고
                그 중단 또는 이용 제한의 해제조건이 성취되지 아니하는 경우,
                회사는 사전에 이용계약 해지 예정임을 통지하고 이용계약을 해지할 수 있습니다.
              </li>
              <li>이용계약이 해지되는 경우, 회사는 법령 및 개인정보처리방침에 따라 회원의 정보를 보유하는 경우를 제외하고 회원의 정보를 삭제합니다.</li>
              <li>이용계약이 해지된 경우라도 회원은 다시 회사에 대하여 이용계약의 체결을 신청할 수 있습니다. 다만, 부정이용 등의 사유가 있는 경우 재가입에 제한이 있을 수 있습니다.</li>
            </ol>
          </section>

          {/* 제13조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제13조 (환불 정책)</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>유료 플랜 결제 후 7일 이내에 서비스를 이용하지 않은 경우(키워드 조회, AI 콘텐츠 생성 등 유료 기능 미사용) 전액 환불이 가능합니다.</li>
              <li>유료 기능을 1회 이상 사용한 경우, 해당 결제 주기의 환불은 불가합니다. 다만, 해지를 신청하면 현재 결제 주기가 끝나는 시점까지 서비스를 이용할 수 있으며, 다음 결제는 이루어지지 않습니다.</li>
              <li>환불 요청은 서비스 내 설정 또는 이메일(soseon203@gmail.com)을 통해 가능합니다.</li>
              <li>회사의 귀책사유로 서비스를 이용하지 못한 경우, 해당 기간에 대해 일할 계산하여 환불 또는 이용 기간 연장으로 보상합니다.</li>
            </ol>
          </section>

          {/* 제14조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제14조 (저작권의 귀속 및 이용제한)</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>회사가 작성한 저작물(서비스 UI, 코드, 디자인, 브랜드 등)에 대한 저작권 기타 지식재산권은 회사에 귀속합니다.</li>
              <li>회원은 서비스를 이용함으로써 얻은 정보 중 회사에게 지적재산권이 귀속된 정보를 회사의 사전 승낙 없이 복제, 송신, 출판, 배포, 방송 기타 방법에 의하여 영리목적으로 이용하거나 제3자에게 이용하게 하여서는 안 됩니다.</li>
              <li>AI를 통해 생성된 콘텐츠에 대해서는 회원이 자유롭게 사용할 수 있습니다. 다만, 서비스의 운영 및 품질 개선 목적으로 회사가 익명화된 형태로 활용할 수 있습니다.</li>
            </ol>
          </section>

          {/* 제15조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제15조 (개인정보의 보호)</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>회원의 개인정보는 서비스의 원활한 제공을 위하여 회원이 동의한 목적과 범위 내에서만 이용됩니다. 회사는 법령에 의하거나 회원이 별도로 동의하지 아니하는 한, 회원의 개인정보를 제3자에게 제공하지 아니합니다.</li>
              <li>이에 대한 자세한 사항은 <Link href="/privacy" className="text-primary underline">개인정보처리방침</Link>에서 정합니다.</li>
              <li>회사는 회원의 귀책사유로 개인정보가 유출되어 발생한 피해에 대하여 책임을 지지 않습니다.</li>
            </ol>
          </section>

          {/* 제16조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제16조 (회사의 책임)</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>회사는 서비스 이용 과정에서 시스템 오류, 서버 문제 등 회사의 귀책사유로 생긴 문제에 대해서 손해를 배상할 책임을 집니다.</li>
              <li>제1항에도 불구하고, 회사는 천재지변, 회사의 귀책사유가 없는 정전, 화재, 통신장애, 기타 불가항력적인 사유로 처리할 수 없거나 지연된 경우에 이용자에게 그 사유를 통지하였을 때에는 책임을 지지 않습니다.</li>
              <li>회사는 AI가 생성한 콘텐츠의 정확성, 완전성을 보증하지 않으며, AI 생성 결과물의 활용으로 인한 손해에 대해 책임을 부담하지 않습니다.</li>
              <li>회사는 네이버 검색광고 API, 네이버 데이터랩 API 등 외부 API 제공 업체의 정책 변경, 장애, 데이터 부정확으로 인한 손해에 대해 책임을 부담하지 않습니다.</li>
              <li>회사는 회원이 서비스를 통해 얻은 키워드 데이터, SEO 점수, 순위 정보 등을 기반으로 한 사업 의사결정의 결과에 대해 책임을 부담하지 않습니다.</li>
            </ol>
          </section>

          {/* 제17조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제17조 (이용자에 대한 통지)</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>회사는 특정 이용자에 대한 통지를 하는 경우, 회원의 회원정보에 기재된 이메일을 통해 통지합니다.</li>
              <li>회사는 불특정다수 이용자에 대한 통지를 하는 경우 NaverSEO Pro 웹사이트에 공지함으로써 개별 통지에 갈음할 수 있습니다.</li>
            </ol>
          </section>

          {/* 제18조 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">제18조 (분쟁의 해결)</h2>
            <p>
              본 약관 또는 서비스는 대한민국 법령에 의하여 규정되고 이행됩니다.
              서비스 이용과 관련하여 회사와 회원 간의 분쟁이 발생하면 당사자 사이의 해결을 위하여 노력하되,
              그럼에도 불구하고 해결되지 아니하면 대한민국의 민사소송법에 따른 관할 법원에 소를 제기할 수 있습니다.
            </p>
          </section>

          {/* 부칙 */}
          <section className="border-t pt-8">
            <h2 className="mb-3 text-lg font-semibold text-foreground">부칙</h2>
            <p>본 약관은 2026년 2월 19일부터 시행합니다.</p>
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