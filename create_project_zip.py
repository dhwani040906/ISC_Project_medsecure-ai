
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import re

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "MedSecure_AI_Source_Code.zip"

EXCLUDED_DIRS = {
    ".venv", "venv", "node_modules", "__pycache__",
    ".git", "dist", "build", ".pytest_cache",
    ".mypy_cache", ".ruff_cache", ".next",
    "encrypted_images", "encrypted_reports",
    "keys", "dataset", "datasets", "checkpoints",
    "uploads", "media"
}

EXCLUDED_SUFFIXES = {
    ".pem", ".key", ".p12", ".pfx", ".crt",
    ".enc", ".pt", ".pth", ".ckpt", ".onnx",
    ".h5", ".hdf5", ".safetensors",
    ".jpg", ".jpeg", ".png", ".dcm",
    ".pdf", ".zip", ".db", ".sqlite", ".sqlite3",
    ".csv", ".parquet", ".npy", ".npz"
}

EXCLUDED_NAMES = {
    ".env", ".env.local", ".env.production",
    ".env.development", ".env.test",
    ".env.staging", ".env.backup",
    ".DS_Store", "Thumbs.db"
}

SENSITIVE_PATTERNS = [
    re.compile(
        r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"
    ),
    re.compile(
        r"postgresql(?:\+[\w]+)?://[^\s\"']+",
        re.IGNORECASE
    ),
]

INCLUDE_DIRS = ["backend", "frontend"]

count = 0
skipped = 0

with ZipFile(OUTPUT, "w", ZIP_DEFLATED) as archive:
    for folder_name in INCLUDE_DIRS:
        folder = ROOT / folder_name

        if not folder.exists():
            print(f"Folder not found: {folder_name}")
            continue

        for path in folder.rglob("*"):
            if not path.is_file():
                continue

            relative = path.relative_to(ROOT)

            if any(
                part.lower() in EXCLUDED_DIRS
                for part in relative.parts[:-1]
            ):
                skipped += 1
                continue

            name = path.name.lower()

            if (
                name in EXCLUDED_NAMES
                or name.startswith(".env.")
                or path.suffix.lower() in EXCLUDED_SUFFIXES
                or "secret" in name
                or "private_key" in name
                or "credentials" in name
            ):
                skipped += 1
                continue

            if path.stat().st_size > 5 * 1024 * 1024:
                skipped += 1
                continue

            # Exclude files containing obvious secrets.
            try:
                content = path.read_text(
                    encoding="utf-8"
                )
                if any(
                    pattern.search(content)
                    for pattern in SENSITIVE_PATTERNS
                ):
                    skipped += 1
                    continue
            except (UnicodeError, OSError):
                skipped += 1
                continue

            archive.write(path, relative)
            count += 1

print("\nZIP created successfully!")
print(f"File: {OUTPUT}")
print(f"Files included: {count}")
print(f"Files excluded: {skipped}")
print("\nReview ZIP contents before sharing.")
