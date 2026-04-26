from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
import tempfile
import traceback
from urllib.parse import urlparse
import cgi

import new1

HOST = "127.0.0.1"
PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def parse_json_from_script(image_path):
    return new1.extract_json_data(image_path)


class RequestHandler(BaseHTTPRequestHandler):
    def _send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_file(self, filename, content_type):
        path = os.path.join(BASE_DIR, filename)
        if not os.path.exists(path):
            self.send_error(404, "File not found")
            return

        with open(path, "rb") as f:
            content = f.read()

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self):
        route = urlparse(self.path).path
        if route in ("/", "/index.html"):
            return self._serve_file("index.html", "text/html; charset=utf-8")
        if route == "/styles.css":
            return self._serve_file("styles.css", "text/css; charset=utf-8")
        if route == "/script.js":
            return self._serve_file("script.js", "application/javascript; charset=utf-8")

        self.send_error(404, "Not found")

    def do_POST(self):
        route = urlparse(self.path).path
        if route != "/extract":
            return self._send_json({"error": "Not found"}, status=404)

        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": self.headers.get("Content-Type", ""),
            },
        )

        image_field = form["image"] if "image" in form else None
        if image_field is None or not getattr(image_field, "file", None):
            return self._send_json({"error": "Image file is required"}, status=400)

        filename = getattr(image_field, "filename", "upload.jpg") or "upload.jpg"
        _, ext = os.path.splitext(filename)
        if not ext:
            ext = ".jpg"

        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                temp_path = tmp.name
                tmp.write(image_field.file.read())

            extracted = parse_json_from_script(temp_path)
            return self._send_json({"rows": extracted}, status=200)
        except Exception as exc:
            return self._send_json(
                {
                    "error": "Failed to process image",
                    "details": str(exc),
                    "trace": traceback.format_exc(),
                },
                status=500,
            )
        finally:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)


def run():
    server = HTTPServer((HOST, PORT), RequestHandler)
    print(f"Server running at http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    run()
