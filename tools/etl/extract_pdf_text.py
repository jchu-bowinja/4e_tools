"""
Extract plain text from D&D 4E sourcebook PDFs (project root or given folder).

Uses pypdf, consistent with extract_monster_templates_from_pdfs.py.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path
from typing import List

from pypdf import PdfReader


def collect_pdf_paths(root: Path, recursive: bool) -> List[Path]:
    pattern = "**/*.pdf" if recursive else "*.pdf"
    return sorted(path for path in root.glob(pattern) if path.is_file())


def _safe_stem(pdf: Path) -> str:
    stem = pdf.stem
    stem = re.sub(r'[<>:"/\\|?*]', "_", stem)
    stem = stem.strip() or "sourcebook"
    return stem


def extract_pdf_text(pdf_path: Path) -> str:
    reader = PdfReader(str(pdf_path), strict=False)
    parts: List[str] = []
    for i, page in enumerate(reader.pages):
        raw = page.extract_text() or ""
        parts.append(f"\n\n--- Page {i + 1} ---\n\n")
        parts.append(raw)
    return "".join(parts).replace("\x00", " ")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract text from PDFs under a folder into .txt file(s)."
    )
    parser.add_argument(
        "source_root",
        nargs="?",
        default=".",
        help="Directory containing PDFs (default: current directory).",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="generated/sourcebook_text",
        help="Output directory for one .txt per PDF, or file path if --single.",
    )
    parser.add_argument(
        "--recursive",
        action="store_true",
        help="Include PDFs in subfolders.",
    )
    parser.add_argument(
        "--single",
        action="store_true",
        help="Write all books into one file (--output must be a file path).",
    )
    args = parser.parse_args()

    root = Path(args.source_root)
    pdfs = collect_pdf_paths(root, recursive=args.recursive)
    if not pdfs:
        print(f"No PDF files found under {root.resolve()}")
        return

    if args.single:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        chunks: List[str] = []
        for pdf in pdfs:
            chunks.append(f"\n\n{'=' * 72}\n")
            chunks.append(f"SOURCE: {pdf.name}\n")
            chunks.append(f"{'=' * 72}\n\n")
            chunks.append(extract_pdf_text(pdf))
        out_path.write_text("".join(chunks), encoding="utf-8", newline="\n")
        print(f"Wrote combined text ({len(pdfs)} PDFs): {out_path}")
        return

    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)
    for pdf in pdfs:
        txt_path = out_dir / f"{_safe_stem(pdf)}.txt"
        txt_path.write_text(extract_pdf_text(pdf), encoding="utf-8", newline="\n")
        print(f"Wrote {txt_path}")
    print(f"Done: {len(pdfs)} file(s) in {out_dir.resolve()}")


if __name__ == "__main__":
    main()
