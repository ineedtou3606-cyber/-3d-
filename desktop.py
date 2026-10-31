"""Desktop entry point, packaged with PyInstaller on the target OS."""
import signal
import threading
import webbrowser
from http.server import ThreadingHTTPServer

from server import Handler


def main():
    # A fixed local port preserves browser localStorage between launches.
    try:
        server = ThreadingHTTPServer(('127.0.0.1', 38763), Handler)
    except OSError:
        print('사록을 시작할 수 없습니다. 이미 실행 중인 사록을 종료한 후 다시 실행해주세요.')
        return 1
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()

    def stop(signum=None, frame=None):
        server.shutdown()

    signal.signal(signal.SIGINT, stop)
    if hasattr(signal, 'SIGTERM'):
        signal.signal(signal.SIGTERM, stop)
    print('사록 역사 영상 스튜디오를 실행했습니다.', flush=True)
    print('앱은 기본 브라우저에서 열립니다. 이 실행 창을 닫으면 프로그램이 종료됩니다.', flush=True)
    print('종료하려면 Ctrl+C를 누르세요.', flush=True)
    webbrowser.open('http://127.0.0.1:38763/')
    try:
        worker.join()
    except KeyboardInterrupt:
        server.shutdown()
    finally:
        server.server_close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
