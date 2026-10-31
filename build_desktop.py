"""Run on the OS for which the executable is intended."""
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parent
command = [sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean',
           '--onefile', '--name', 'Sarok', '--console']
for source, destination in [('index.html', '.'), ('style.css', '.'), ('src/app.js', 'src'), ('src/engine.js', 'src')]:
    command += ['--add-data', f'{root / source}:{destination}']
command.append(str(root / 'desktop.py'))
subprocess.run(command, cwd=root, check=True)
print('완료: dist 폴더의 Sarok 실행 파일을 사용하세요. 이 파일은 빌드한 운영체제용입니다.')
