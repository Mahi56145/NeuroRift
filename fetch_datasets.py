import kaggle
import json
import os

LIMIT = 100

datasets = []
page = 1

while len(datasets) < LIMIT:
    page_items = kaggle.api.dataset_list(
        search="machine learning",
        sort_by="votes",
        page=page,
    )

    if not page_items:
        break

    datasets.extend(page_items)
    page += 1

data = []

for d in datasets[:LIMIT]:
    data.append({
        "name": d.title,
        "slug": d.ref,
        "category": "General",
        "size": getattr(d, "size", getattr(d, "totalBytes", getattr(d, "total_bytes", None))),
        "votes": getattr(d, "voteCount", getattr(d, "vote_count", 0)),
        "kaggle_url": f"https://www.kaggle.com/datasets/{d.ref}"
    })

output_file = os.path.join(os.path.dirname(__file__), "app", "api", "seed", "datasets.json")

with open(output_file, "w") as f:
    json.dump(data, f, indent=2)

print(f"Saved {len(data)} datasets to {output_file}")