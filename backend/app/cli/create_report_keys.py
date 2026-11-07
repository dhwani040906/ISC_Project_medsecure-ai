"""Create report signing keys; never overwrite existing keys."""
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from app.core.config import get_settings

def main():
    settings = get_settings()
    private = Path(settings.report_signing_private_key_path).resolve()
    public = Path(settings.report_signing_public_key_path).resolve()
    if private.exists() or public.exists():
        raise SystemExit("Refusing to overwrite existing signing key(s). Keep the existing pair.")
    private.parent.mkdir(parents=True, exist_ok=True)
    public.parent.mkdir(parents=True, exist_ok=True)
    key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
    private.write_bytes(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))
    try:
        if __import__('os').name != 'nt': private.chmod(0o600)
        public.write_bytes(key.public_key().public_bytes(serialization.Encoding.PEM,serialization.PublicFormat.SubjectPublicKeyInfo))
    except Exception:
        private.unlink(missing_ok=True)
        raise
    print("Report signing key pair created. Back up and protect the private key.")

if __name__ == '__main__': main()
