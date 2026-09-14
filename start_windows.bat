@echo off
chcp 65001 >nul
echo [민국 홀덤] 서버를 시작합니다.
if not exist node_modules (
  echo 처음 실행입니다. 필요한 모듈을 설치합니다...
  npm install
)
npm start
pause
