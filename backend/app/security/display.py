"""UI references only: database IDs remain unchanged."""
def reference(prefix: str, identifier: str) -> str:
    return f"{prefix}-{identifier.replace('-', '')[:12].upper()}"
