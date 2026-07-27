"""Vercel Function for the reader's existing article API."""

from __future__ import annotations

import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

from main import article_files, parse_article, random_article


class handler(BaseHTTPRequestHandler):
    """Serve the public article API through Vercel's Python runtime."""

    def do_GET(self) -> None:  # noqa: N802 - HTTP handler API
        query = parse_qs(urlparse(self.path).query)
        route = query.get("route", [""])[0]

        if route == "random":
            self.send_json(random_article())
            return
        if route == "articles":
            self.send_json(
                [
                    {"id": file.stem.split("-", 1)[0], "title": file.stem.split("-", 1)[-1]}
                    for file in article_files()
                ]
            )
            return
        if route == "article":
            article_id = query.get("id", [""])[0]
            match = next(
                (file for file in article_files() if file.stem.startswith(article_id + "-")),
                None,
            )
            if match:
                self.send_json(parse_article(match))
            else:
                self.send_error(HTTPStatus.NOT_FOUND, "Article not found")
            return

        self.send_error(HTTPStatus.NOT_FOUND, "API endpoint not found")

    def send_json(self, payload: object) -> None:
        content = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def log_message(self, format: str, *args: object) -> None:
        print("[vercel-reader] " + format % args)
