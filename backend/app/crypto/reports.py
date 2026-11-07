"""Detached RSA-PSS signatures; AES-GCM-encrypted PDF storage.

Signatures are stored in PostgreSQL, NOT embedded as PDF/PAdES signatures.
"""
import hashlib
import io
import os
import uuid
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from app.core.config import get_settings
from app.crypto.images import encrypt_bytes, decrypt_bytes
from app.security.display import reference
from datetime import timezone, timedelta

DISCLAIMER = "RESEARCH ONLY - NOT A MEDICAL DIAGNOSIS. Seek qualified clinical review."

def report_path(report_id):
    uuid.UUID(report_id)
    root = Path(get_settings().report_storage_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root / f"{report_id}.enc"

def signing_keys():
    settings = get_settings()
    priv = Path(settings.report_signing_private_key_path).resolve()
    pub = Path(settings.report_signing_public_key_path).resolve()
    if not priv.is_file() or not pub.is_file():
        raise RuntimeError("Report signing keys missing; run python -m app.cli.create_report_keys")
    private = serialization.load_pem_private_key(priv.read_bytes(), password=None)
    public = serialization.load_pem_public_key(pub.read_bytes())
    return private, public

def sign_pdf(pdf):
    private, _ = signing_keys()
    return private.sign(pdf, padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.MAX_LENGTH), hashes.SHA256())

def verify_pdf(pdf, signature):
    from cryptography.exceptions import InvalidSignature
    public_path = Path(get_settings().report_signing_public_key_path).resolve()
    public = serialization.load_pem_public_key(public_path.read_bytes())
    try:
        public.verify(signature, pdf, padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.MAX_LENGTH), hashes.SHA256())
        return True
    except InvalidSignature:
        return False

def build_pdf(report_id, prediction, pseudonym, xray_id, patient_name=None, patient_username=None, doctor_name=None, doctor_username=None):
    """Generate a newly signed report. Existing reports remain immutable."""
    from xml.sax.saxutils import escape
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=(595.28, 841.89), leftMargin=54, rightMargin=54,
                            topMargin=56, bottomMargin=56, title="MedSecure AI Research Report")
    styles = getSampleStyleSheet()
    story = [Paragraph("MedSecure AI | Chest X-ray Analysis", styles['Title']), Spacer(1, 18)]
    values = [
        ("Patient full name", patient_name or "Not provided"),
        ("Patient username", patient_username or "Not provided"),
        ("Patient reference", pseudonym),
        ("Report number", reference("RPT", report_id)),
        ("X-ray reference", reference("XR", xray_id)),
        ("Analysis reference", reference("AI", prediction.id)),
    ]
    if doctor_name or doctor_username:
        values.extend([("Report requested by (doctor)", doctor_name or "Not provided"),
                       ("Doctor username", doctor_username or "Not provided")])
    values.extend([
        ("Model version", prediction.model_version),
        ("Predicted label", prediction.label),
        ("Model score (uncalibrated)", f"{prediction.confidence * 100:.1f}%"),
    ])
    if prediction.created_at:
        dt = prediction.created_at
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        values.append(("Prediction recorded (IST)", dt.astimezone(timezone(timedelta(hours=5, minutes=30))).strftime('%d %B %Y, %I:%M %p IST')))
    rows = [[Paragraph(escape(str(k)), styles['Normal']), Paragraph(escape(str(v)), styles['Normal'])] for k,v in values]
    table = Table(rows, colWidths=[190, 290], hAlign='LEFT')
    table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'), ('BOTTOMPADDING',(0,0),(-1,-1),10),
                               ('LINEBELOW',(0,0),(-1,-2),0.4,colors.lightgrey)]))
    story.extend([table, Spacer(1, 20), Paragraph(escape(DISCLAIMER), styles['Heading3']),
                  Spacer(1, 10), Paragraph("The model score is not a calibrated clinical probability. This PDF has a detached RSA-PSS/SHA-256 signature held in MedSecure AI; verify it through the authorized application. The requesting doctor is not necessarily the clinical reviewer.", styles['BodyText'])])
    doc.build(story)
    return buf.getvalue()
