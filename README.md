# 나만의 맞춤법 검사기

다음(DAUM)과 부산대학교(PNU) 웹 서비스를 이용하는 `hanspell`을 기반으로, 사용자가 입력한 한국어 텍스트의 맞춤법/문법을 검사하고 결과를 확인·적용할 수 있는 웹 앱입니다.

- 기술 스택: Next.js(App Router) · TypeScript · TailwindCSS · shadcn/ui
- 검사 엔진: `hanspell` (DAUM, PNU, ALL 지원)
- 기능 요약:
  - 텍스트 입력 → 검사 → 제안/도움말/문맥 확인
  - 좌측 교정 미리보기(제안어 하이라이트), 우측 상세/목록 패널
  - 대치어를 입력해 본문에 일괄 적용

참고: `hanspell` 문서는 아래를 확인하세요. [npm: hanspell](https://www.npmjs.com/package/hanspell)

주의: PNU 서비스는 권리자 고지대로 개인·학생만 무료 사용입니다. 상업적 사용 전 정책을 확인하세요.

## 실행 방법(개발)

```bash
npm i
npm run dev
# 브라우저에서 http://localhost:3000 접속
```

## 프로덕션 빌드

```bash
npm run build
npm run start
```

## 사용 방법

1. 텍스트를 입력합니다.
2. 검사 서비스(DAUM/PNU/ALL)를 선택하고 “맞춤법 검사”를 누릅니다.
3. 우측 목록에서 항목을 선택하면 상세 정보와 대치어를 볼 수 있습니다.
4. 필요 시 대치어를 수정하고 “적용”을 눌러 본문에 반영합니다.
