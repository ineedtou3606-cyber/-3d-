@echo off
chcp 65001 >nul
cd /d "%~dp0"
py -3 --version >nul 2>&1
if errorlevel 1 (
  echo Python 3을 먼저 설치해주세요. https://www.python.org/downloads/windows/
  pause
  exit /b 1
)
py -3 -m venv .build-venv
if errorlevel 1 goto failed
.build-venv\Scripts\python.exe -m pip install -r requirements-desktop.txt
if errorlevel 1 goto failed
.build-venv\Scripts\python.exe build_desktop.py
if errorlevel 1 goto failed
echo dist\Sarok.exe 파일이 만들어졌습니다. 더블클릭해서 실행하세요.
pause
exit /b 0
:failed
echo 실행 파일 생성에 실패했습니다. 위 오류를 확인해주세요.
pause
exit /b 1
