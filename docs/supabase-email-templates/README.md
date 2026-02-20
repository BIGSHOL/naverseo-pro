# Supabase 이메일 템플릿 적용 가이드

NaverSEO Pro 브랜딩 이메일 템플릿 5종입니다.

## 파일 목록

| 파일 | Supabase 메뉴 | Subject (제목) |
|------|--------------|----------------|
| `confirm-signup.html` | Confirm sign up | `NaverSEO Pro - 이메일 인증을 완료해주세요` |
| `magic-link.html` | Magic Link | `NaverSEO Pro - 로그인 링크가 도착했습니다` |
| `reset-password.html` | Reset Password | `NaverSEO Pro - 비밀번호를 재설정해주세요` |
| `change-email.html` | Change Email Address | `NaverSEO Pro - 이메일 변경을 확인해주세요` |
| `invite-user.html` | Invite User | `NaverSEO Pro에 초대되셨습니다!` |

## 적용 방법

1. **Supabase Dashboard** 접속 → 프로젝트 선택
2. **Authentication** → **Emails** 탭 이동
3. 각 이메일 타입 클릭 (Confirm sign up, Magic Link 등)
4. **Subject** 필드에 위 표의 제목 입력
5. **Body** 의 Source 모드에서 기존 내용 모두 삭제
6. 해당 `.html` 파일 내용을 복사하여 붙여넣기
7. **Save changes** 클릭

## 미리보기 확인

각 HTML 파일을 브라우저에서 직접 열면 미리보기를 확인할 수 있습니다.
Supabase 에디터의 **Preview** 탭에서도 확인 가능합니다.

## 사용된 변수

| 변수 | 설명 | 사용 파일 |
|------|------|-----------|
| `{{ .ConfirmationURL }}` | 인증/확인 링크 | 전체 |
| `{{ .Email }}` | 사용자 이메일 | confirm-signup |
| `{{ .SiteURL }}` | 사이트 URL | (미사용) |
| `{{ .Token }}` | 인증 토큰 | (미사용) |

## 디자인 스펙

- **Primary 색상**: `#02BA5A` (NaverSEO Pro 에메랄드 그린)
- **폰트**: Apple SD Gothic Neo → Malgun Gothic → Helvetica → Arial
- **카드 너비**: 480px (모바일 호환)
- **레이아웃**: 테이블 기반 (이메일 클라이언트 호환)
- **인라인 스타일**: 모든 스타일 인라인 처리 (Gmail, Outlook 등 지원)
