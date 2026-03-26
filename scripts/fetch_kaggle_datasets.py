#!/usr/bin/env python3
"""
Builds/updates app/api/seed/datasets.json from Kaggle metadata.

Usage examples:
  python scripts/fetch_kaggle_datasets.py --target 600 --sort-by votes --output app/api/seed/datasets.json
  python scripts/fetch_kaggle_datasets.py --target 550 --sort-by updated --merge

Requirements:
  pip install kaggle
  Set KAGGLE_USERNAME and KAGGLE_KEY (or ~/.kaggle/kaggle.json)
"""

from __future__ import annotations

import argparse
import inspect
import json
import math
import os
from pathlib import Path
from typing import Any


def _safe_get(obj: Any, *keys: str, default=None):
  for k in keys:
    if hasattr(obj, k):
      v = getattr(obj, k)
      if v is not None:
        return v
    if isinstance(obj, dict) and k in obj and obj[k] is not None:
      return obj[k]
  return default


def _normalize_url(ref: str) -> str:
  ref = str(ref).strip("/")
  return f"https://www.kaggle.com/datasets/{ref}"


def fetch_kaggle_datasets(target: int, sort_by: str, page_size: int) -> list[dict[str, Any]]:
  from kaggle.api.kaggle_api_extended import KaggleApi

  api = KaggleApi()
  api.authenticate()

  rows: dict[str, dict[str, Any]] = {}
  pages = max(2, math.ceil(target / page_size) + 4)

  for page in range(1, pages + 1):
    # Some client versions support page_size, some do not.
    params = inspect.signature(api.dataset_list).parameters
    kwargs: dict[str, Any] = {"sort_by": sort_by, "page": page}
    if "page_size" in params:
      kwargs["page_size"] = page_size
    listed = api.dataset_list(**kwargs)

    if not listed:
      break

    for item in listed:
      ref = _safe_get(item, "ref")
      if not ref:
        continue

      title = _safe_get(item, "title", "name") or ref.split("/")[-1]
      votes = _safe_get(item, "voteCount", "vote_count", default=0) or 0
      size = _safe_get(item, "size", "totalBytes", "total_bytes", default=0) or 0

      rows[ref] = {
        "name": title,
        "slug": ref,
        "category": "General",
        "size": int(size) if str(size).isdigit() else size,
        "votes": int(votes) if str(votes).isdigit() else 0,
        "kaggle_url": _normalize_url(ref),
      }

      if len(rows) >= target:
        break

    if len(rows) >= target:
      break

  out = list(rows.values())
  out.sort(key=lambda x: x.get("votes", 0), reverse=True)
  return out[:target]


def load_existing(path: Path) -> list[dict[str, Any]]:
  if not path.exists():
    return []
  with path.open("r", encoding="utf-8") as f:
    data = json.load(f)
  if isinstance(data, list):
    return data
  return []


def merge_by_slug(old_rows: list[dict[str, Any]], new_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
  merged: dict[str, dict[str, Any]] = {}

  for row in old_rows + new_rows:
    slug = str(row.get("slug", "")).strip()
    if not slug:
      continue
    merged[slug] = {
      "name": row.get("name") or slug.split("/")[-1],
      "slug": slug,
      "category": row.get("category") or "General",
      "size": row.get("size", 0),
      "votes": row.get("votes", 0),
      "kaggle_url": row.get("kaggle_url") or _normalize_url(slug),
    }

  rows = list(merged.values())
  rows.sort(key=lambda x: int(x.get("votes") or 0), reverse=True)
  return rows


def main() -> int:
  parser = argparse.ArgumentParser(description="Fetch top Kaggle datasets for seeding")
  parser.add_argument("--target", type=int, default=600, help="How many datasets to output")
  parser.add_argument("--sort-by", type=str, default="votes", choices=["votes", "updated", "hottest", "active", "published"], help="Kaggle sort mode")
  parser.add_argument("--page-size", type=int, default=100, help="Requested Kaggle page size")
  parser.add_argument("--output", type=str, default="app/api/seed/datasets.json", help="Output JSON path")
  parser.add_argument("--merge", action="store_true", help="Merge with existing output file by slug")
  args = parser.parse_args()

  if not os.environ.get("KAGGLE_USERNAME") and not Path.home().joinpath(".kaggle", "kaggle.json").exists():
    print("Kaggle credentials not found. Set KAGGLE_USERNAME/KAGGLE_KEY or create ~/.kaggle/kaggle.json")
    return 1

  output_path = Path(args.output)
  output_path.parent.mkdir(parents=True, exist_ok=True)

  fetched = fetch_kaggle_datasets(target=args.target, sort_by=args.sort_by, page_size=args.page_size)
  if args.merge:
    existing = load_existing(output_path)
    final_rows = merge_by_slug(existing, fetched)
    final_rows = final_rows[: args.target]
  else:
    final_rows = fetched

  with output_path.open("w", encoding="utf-8") as f:
    json.dump(final_rows, f, indent=2)

  print(f"Wrote {len(final_rows)} rows -> {output_path}")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
