import base64
import io
import json
import os
import unittest
import urllib.error
from unittest.mock import patch

from PIL import Image
from server import ImageError, generate_image


class ImageApiTests(unittest.TestCase):
    def response(self):
        out = io.BytesIO()
        Image.new('RGB', (1536, 1024), 'green').save(out, format='PNG')
        return io.BytesIO(json.dumps({'data': [{'b64_json': base64.b64encode(out.getvalue()).decode()}]}).encode())

    def test_missing_key_does_not_call_provider(self):
        with patch.dict(os.environ, {}, clear=True), patch('urllib.request.urlopen') as call:
            with self.assertRaises(ImageError) as result:
                generate_image('역사 장면')
            self.assertEqual(result.exception.status, 503)
            call.assert_not_called()

    @patch.dict(os.environ, {'SAROK_IMAGE_API_KEY': 'test-only'})
    def test_generation_request_and_actual_16_9_image(self):
        with patch('urllib.request.urlopen', return_value=self.response()) as call:
            result = generate_image('역사 만화')
        request = call.call_args.args[0]
        self.assertEqual(request.full_url, 'https://api.openai.com/v1/images/generations')
        self.assertEqual(json.loads(request.data)['model'], 'gpt-image-1')
        raw = base64.b64decode(result['image'].split(',', 1)[1])
        with Image.open(io.BytesIO(raw)) as image:
            self.assertEqual(image.size, (1536, 864))

    @patch.dict(os.environ, {'SAROK_IMAGE_API_KEY': 'test-only'})
    def test_edit_sends_the_specific_source(self):
        source = io.BytesIO()
        Image.new('RGB', (120, 120), 'blue').save(source, format='PNG')
        original = source.getvalue()
        with patch('urllib.request.urlopen', return_value=self.response()) as call:
            result = generate_image('한국어 인포그래픽 추가', original)
        request = call.call_args.args[0]
        self.assertTrue(request.full_url.endswith('/edits'))
        self.assertIn(original, request.data)
        self.assertIn(b'name="image"', request.data)
        self.assertEqual(result['width'], result['height'])

    @patch.dict(os.environ, {'SAROK_IMAGE_API_KEY': 'test-only'})
    def test_provider_errors_do_not_expose_response_or_key(self):
        for code in [400, 401, 403, 429, 500]:
            with self.subTest(code=code):
                error = urllib.error.HTTPError('https://api.openai.com', code, 'private provider error', {}, None)
                with patch('urllib.request.urlopen', side_effect=error):
                    with self.assertRaises(ImageError) as result:
                        generate_image('대본')
                self.assertNotIn('test-only', result.exception.message)
                self.assertNotIn('private provider error', result.exception.message)

    @patch.dict(os.environ, {'SAROK_IMAGE_API_KEY': 'test-only'})
    def test_invalid_image_is_not_reported_as_success(self):
        with patch('urllib.request.urlopen', return_value=io.BytesIO(b'{"data":[]}')):
            with self.assertRaises(ImageError) as result:
                generate_image('대본')
        self.assertEqual(result.exception.status, 502)

    @patch.dict(os.environ, {'SAROK_IMAGE_API_KEY': 'test-only'})
    def test_quality_is_sent_to_provider(self):
        for quality in ['low', 'medium', 'high']:
            with patch('urllib.request.urlopen', return_value=self.response()) as call:
                generate_image('토끼와 거북이', quality=quality)
            self.assertEqual(json.loads(call.call_args.args[0].data)['quality'], quality)


if __name__ == '__main__':
    unittest.main()
