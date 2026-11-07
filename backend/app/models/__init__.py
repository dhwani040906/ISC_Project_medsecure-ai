from app.models.entities import (User, Patient, Doctor, PatientDoctorPermission, XrayRecord, EncryptionMetadata, Prediction, MedicalReport, DigitalSignature, AuditLog, SecurityEvent, ReportEncryptionMetadata, AuditChainEntry, ClinicalReview)

# Register transaction-scoped audit hash chaining for all SQLAlchemy sessions.
import app.security.audit_chain  # noqa: F401
