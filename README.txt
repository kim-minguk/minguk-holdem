민국 홀덤 ONLINE v2
====================

확실히 포함된 기능
- 2~6명 실시간 친구 대전
- 방 생성 / 5자리 방 코드
- 방 비밀번호
- 방장 시작칩 설정
- 블라인드 25/50, 50/100, 100/200
- 초대 링크 자동 생성/복사
- FOLD / CHECK / CALL / RAISE / ALL-IN
- 플랍 / 턴 / 리버 / 쇼다운
- 여러 올인 금액에 따른 사이드팟 분리 정산
- 모바일 브라우저 대응
- Render 배포용 render.yaml 포함

로컬 실행
1. Node.js 18 이상 설치
2. npm install
3. npm start
4. http://localhost:3000

공개 인터넷 배포
1. 이 폴더를 GitHub 저장소에 업로드
2. Render에서 New > Blueprint 또는 Web Service 선택
3. GitHub 저장소 연결
4. render.yaml을 사용하거나 Build Command: npm install / Start Command: npm start
5. 배포 완료 후 생성된 HTTPS 주소 접속
6. 방을 만든 뒤 '초대 링크 복사' → 카카오톡으로 친구에게 전송

중요
- 실제 현금/환전 기능이 없는 무료 포인트 게임입니다.
- 서버를 재시작하면 진행 중인 방 정보는 초기화됩니다.
