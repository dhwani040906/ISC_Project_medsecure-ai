import os
from pathlib import Path
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from app.core.config import get_settings

def main():
    settings = get_settings()
    private_path = Path(settings.image_private_key_path).resolve()
    public_path = Path(settings.image_public_key_path).resolve()
    if private_path.exists() or public_path.exists():
        raise SystemExit("Key file already exists; refusing to overwrite. Back up your keys securely.")
    private_path.parent.mkdir(parents=True, exist_ok=True)
    public_path.parent.mkdir(parents=True, exist_ok=True)
    key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
    private_bytes = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    public_bytes = key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
    with private_path.open("xb") as handle:
        handle.write(private_bytes)
    if os.name != "nt":
        private_path.chmod(0o600)
    with public_path.open("xb") as handle:
        handle.write(public_bytes)
    print("Image wrapping key pair created. Protect and back up the private key; losing it makes images unrecoverable.")

if __name__ == "__main__":
    main()
