"""毛泽东选集随机阅读器——零第三方依赖的本地 Web 服务。"""

from __future__ import annotations

import json
import random
import re
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
ARTICLES = ROOT / "article"


def article_files() -> list[Path]:
    """只暴露真实文章，过滤目录页和摘要页。"""
    return sorted(
        path for path in ARTICLES.glob("*.md") if path.name not in {"目录.md", "SUMMARY.md"}
    )


def paragraph(text: str) -> dict[str, str]:
    text = text.strip().replace("　　", "")
    return {"kind": "paragraph", "text": text}


def parse_article(path: Path) -> dict[str, object]:
    """解析本仓库简洁的 Markdown 文章格式，保留正文与注释的边界。"""
    lines = path.read_text(encoding="utf-8").splitlines()
    title = path.stem.split("-", 1)[-1]
    date = ""
    body: list[dict[str, str]] = []
    notes: list[dict[str, str]] = []
    in_notes = False
    pending: list[str] = []

    def flush() -> None:
        nonlocal pending
        if pending:
            text = " ".join(part.strip() for part in pending).strip()
            if text:
                body.append(paragraph(text))
            pending = []

    for raw in lines:
        line = raw.strip()
        if not line:
            flush()
            continue
        if line.startswith("# "):
            title = line[2:].strip()
            continue
        if re.fullmatch(r"（[^）]+）", line) and not date:
            date = line
            continue
        if re.fullmatch(r"-{3,}", line):
            flush()
            continue
        if re.fullmatch(r"注\s*释", line.replace("　", "")):
            flush()
            in_notes = True
            continue
        if in_notes:
            match = re.match(r"[〔\[]\s*(\d+)\s*[〕\]]\s*(.*)", line)
            if match:
                notes.append({"number": match.group(1), "text": match.group(2).strip()})
            elif notes:
                notes[-1]["text"] += " " + line
            continue
        if line.startswith(">"):
            flush()
            body.append({"kind": "quote", "text": line.lstrip(">").strip()})
            continue
        if line.startswith("## "):
            flush()
            body.append({"kind": "heading", "text": line[3:].strip()})
            continue
        pending.append(line)
    flush()

    return {
        "id": path.stem.split("-", 1)[0],
        "title": title,
        "date": date,
        "body": body,
        "notes": notes,
    }


def random_article() -> dict[str, object]:
    files = article_files()
    if not files:
        raise FileNotFoundError("article 文件夹中没有可用文章")
    return parse_article(random.choice(files))


class ReaderHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self) -> None:  # noqa: N802 - HTTP handler API
        route = urlparse(self.path).path
        if route == "/api/random":
            self.send_json(random_article())
            return
        if route == "/api/articles":
            self.send_json(
                [
                    {"id": file.stem.split("-", 1)[0], "title": file.stem.split("-", 1)[-1]}
                    for file in article_files()
                ]
            )
            return
        if route.startswith("/api/article/"):
            article_id = unquote(route.removeprefix("/api/article/"))
            match = next((file for file in article_files() if file.stem.startswith(article_id + "-")), None)
            if match:
                self.send_json(parse_article(match))
            else:
                self.send_error(HTTPStatus.NOT_FOUND, "Article not found")
            return
        if route == "/":
            self.path = "/index.html"
        super().do_GET()

    def send_json(self, payload: object) -> None:
        content = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def end_headers(self) -> None:
        """本地开发时禁止静态文件缓存，避免页面继续使用旧版样式和脚本。"""
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, format: str, *args) -> None:
        print("[reader] " + format % args)


# Vercel imports this handler for the root application entrypoint.
handler = ReaderHandler


if __name__ == "__main__":
    host, port = "127.0.0.1", 8000
    print(f"毛泽东选集随机阅读器已启动：http://{host}:{port}")
    ThreadingHTTPServer((host, port), ReaderHandler).serve_forever()
