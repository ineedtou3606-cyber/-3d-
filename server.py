"""Local development server with a server-side OpenAI image generation endpoint."""
import base64
import binascii
import io
import json
import os
from pathlib import Path
import socket
import threading
import uuid
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from PIL import Image

ROOT = Path(__file__).resolve().parent
KEY_NAME = 'SAROK_IMAGE_API_KEY'
BUSY = threading.BoundedSemaphore(1)
PUBLIC = {'/', '/index.html', '/style.css', '/src/app.js', '/src/engine.js'}


class ImageError(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message


def generate_image(prompt, source=None, quality='medium'):
    key = os.environ.get(KEY_NAME)
    if not key:
        raise ImageError(503, '이미지 생성 키가 없습니다. 환경 설정에서 SAROK_IMAGE_API_KEY를 연결해주세요.')
    ratio = (16, 9)
    if source:
        with Image.open(io.BytesIO(source)) as original:
            ratio = original.size
    fields = {
        'model': 'gpt-image-1', 'prompt': prompt + f'\n중요한 인물과 사물은 화면 중앙의 {ratio[0]}:{ratio[1]} 안전 영역에 배치하세요. 가장자리 여백은 최종 크롭됩니다.',
        'n': 1, 'size': '1536x1024', 'quality': quality, 'output_format': 'png',
    }
    if source:
        boundary = 'sarok-' + uuid.uuid4().hex
        parts = []
        for name, value in fields.items():
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="source.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + source + b'\r\n')
        parts.append(f'--{boundary}--\r\n'.encode())
        payload, content_type, endpoint = b''.join(parts), f'multipart/form-data; boundary={boundary}', 'edits'
    else:
        payload, content_type, endpoint = json.dumps(fields).encode(), 'application/json', 'generations'
    request = urllib.request.Request('https://api.openai.com/v1/images/' + endpoint,
        data=payload, headers={'Authorization': f'Bearer {key}', 'Content-Type': content_type})
    try:
        # urllib retains the inherited HTTPS proxy and system TLS verification.
        with urllib.request.urlopen(request, timeout=180) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        messages = {
            400: '이미지 요청이 거절되었습니다. 대본 내용을 확인하거나 프롬프트를 줄여주세요.',
            401: 'API 키를 인증할 수 없습니다. 환경 설정의 키를 확인해주세요.',
            403: '이미지 API 접근이 거절되었습니다. API 권한과 허용 도메인을 확인해주세요.',
            429: '사용 한도 또는 요청 제한에 도달했습니다. API 잔액과 한도를 확인해주세요.',
        }
        raise ImageError(502, messages.get(error.code, '이미지 서비스에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')) from None
    except (urllib.error.URLError, TimeoutError, socket.timeout):
        raise ImageError(504, '이미지 서비스에 연결할 수 없거나 응답 시간이 초과되었습니다. 연결 상태를 확인해주세요.') from None
    except (ValueError, OSError):
        raise ImageError(502, '이미지 서비스 응답을 읽을 수 없습니다.') from None
    try:
        raw = base64.b64decode(result['data'][0]['b64_json'], validate=True)
        with Image.open(io.BytesIO(raw)) as image:
            image.load()
            width, height = image.size
            # GPT Image supports 3:2 landscape; center-crop the actual output to 16:9.
            crop_w = min(width, height * ratio[0] // ratio[1])
            crop_h = max(1, crop_w * ratio[1] // ratio[0])
            left, top = (width - crop_w) // 2, (height - crop_h) // 2
            output = io.BytesIO()
            image.convert('RGB').crop((left, top, left + crop_w, top + crop_h)).save(output, format='PNG')
            return {'image': 'data:image/png;base64,' + base64.b64encode(output.getvalue()).decode(),
                    'width': crop_w, 'height': crop_h}
    except (KeyError, IndexError, TypeError, ValueError, OSError, binascii.Error):
        raise ImageError(502, '생성 서비스가 올바른 이미지를 반환하지 않았습니다.') from None


class Handler(BaseHTTPRequestHandler):
    def send(self, status, body, content_type='application/json; charset=utf-8'):
        data = json.dumps(body, ensure_ascii=False).encode() if isinstance(body, dict) else body
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        path = urllib.parse.urlsplit(self.path).path
        if path == '/api/status':
            return self.send(200, {'configured': bool(os.environ.get(KEY_NAME)), 'model': 'gpt-image-1'})
        if path not in PUBLIC:
            return self.send(404, {'error': '페이지를 찾을 수 없습니다.'})
        file = ROOT / ('index.html' if path == '/' else path.lstrip('/'))
        mime = {'.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript'}[file.suffix]
        self.send(200, file.read_bytes(), mime + '; charset=utf-8')

    def do_POST(self):
        if self.path != '/api/images':
            return self.send(404, {'error': '요청 경로를 찾을 수 없습니다.'})
        origin = self.headers.get('Origin')
        if origin and urllib.parse.urlsplit(origin).netloc != self.headers.get('Host'):
            return self.send(403, {'error': '다른 사이트에서의 생성 요청은 허용되지 않습니다.'})
        if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
            return self.send(415, {'error': 'JSON 요청이 필요합니다.'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 16000000:
                raise ValueError()
            payload = json.loads(self.rfile.read(length))
            prompt = payload.get('prompt') if isinstance(payload, dict) else None
            if not isinstance(prompt, str) or not 1 <= len(prompt.strip()) <= 12000:
                raise ValueError()
            quality = payload.get('quality', 'medium')
            if quality not in ('low', 'medium', 'high'):
                raise ValueError()
            source = None
            if payload.get('source') is not None:
                value = payload['source']
                if not isinstance(value, str) or not value.startswith('data:image/png;base64,'):
                    raise ValueError()
                source = base64.b64decode(value.split(',', 1)[1], validate=True)
                with Image.open(io.BytesIO(source)) as image:
                    if image.format != 'PNG' or image.width * image.height > 4000000:
                        raise ValueError()
                    image.verify()
        except (ValueError, TypeError, OSError, binascii.Error):
            return self.send(400, {'error': '프롬프트·화질·이미지 입력을 확인해주세요. 프롬프트는 1~12000자여야 합니다.'})
        if not BUSY.acquire(blocking=False):
            return self.send(429, {'error': '다른 이미지를 생성 중입니다. 완료 후 다시 시도해주세요.'})
        try:
            self.send(200, generate_image(prompt, source, quality))
        except ImageError as error:
            self.send(error.status, {'error': error.message})
        finally:
            BUSY.release()


if __name__ == '__main__':
    port = int(os.environ.get('PORT', '3000'))
    print(f'Sarok server listening on port {port}', flush=True)
    ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()
