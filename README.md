# MedSecure AI
### AI-Powered Pneumonia Detection and Secure Medical Record Management System

**MedSecure AI** is a full-stack, AI-assisted healthcare research project designed to support pneumonia detection from chest X-ray images while maintaining the confidentiality, integrity, and controlled accessibility of medical records.

The platform integrates deep learning, medical image analysis, cryptography, role-based access control, and secure report management into a single web application. It provides dedicated interfaces for patients, doctors, and administrators.

> **Disclaimer:** MedSecure AI is an academic and research prototype. Its AI-generated predictions are intended for demonstration and decision-support research only. They must not be used as a substitute for professional medical diagnosis.

---

## 1. Introduction

Artificial intelligence is increasingly being explored in healthcare to assist medical professionals in analyzing diagnostic images, identifying patterns, and improving information accessibility.

Chest X-ray imaging is widely used to investigate respiratory conditions, including pneumonia. However, developing an AI-based healthcare application involves more than training an accurate classification model.

Medical imaging systems also need to address several important concerns:

- Protecting sensitive patient information.
- Preventing unauthorized access to medical records.
- Maintaining the integrity of medical reports.
- Providing interpretable AI predictions.
- Supporting collaboration between patients and doctors.
- Recording security-sensitive activities for accountability.

MedSecure AI was developed to bring these capabilities together in one integrated platform.

Rather than functioning only as an image classification application, MedSecure AI demonstrates how AI-assisted medical imaging can be combined with secure data management and clinical review workflows.

## 2. Problem Statement

Traditional medical record management and standalone AI diagnosis systems may face challenges related to data security, accessibility, transparency, and integration.

In particular:

1. Medical images contain sensitive information that must be protected from unauthorized access.
2. AI-based image classification models may produce predictions without providing sufficient visual explanations.
3. Medical reports require integrity protection to detect unauthorized modifications.
4. Different users, such as patients, doctors, and administrators, require different access privileges.
5. Healthcare applications need reliable records of important actions, including uploads, analysis requests, and report generation.

**Problem statement:**

To design and develop a secure, role-based healthcare web application that uses deep learning for pneumonia detection from chest X-rays, provides interpretable AI predictions, protects medical records through encryption, generates digitally signed reports, and maintains auditable records of system activities.

## 3. Project Objectives

The main objectives of MedSecure AI are:

- Develop a web-based healthcare platform with separate patient, doctor, and administrator interfaces.
- Implement pneumonia classification using a DenseNet121 deep learning model.
- Generate Grad-CAM visualizations to highlight image regions influencing AI predictions.
- Encrypt uploaded chest X-rays using AES-256-GCM.
- Protect encryption keys using RSA-OAEP key wrapping.
- Generate downloadable PDF reports with RSA-PSS digital signatures.
- Implement JWT-based authentication and role-based access control.
- Allow patients to grant authorized doctors access to their medical images.
- Enable doctors to review AI predictions and record clinical observations.
- Maintain tamper-evident audit logs using SHA-256 hash chaining.
- Integrate the frontend, backend, database, machine learning, and security components into one functional system.

## 4. Proposed Solution

MedSecure AI provides an integrated workflow connecting patients, doctors, AI analysis, secure storage, and report generation.

The application is organized around three primary user roles.

### 4.1 Patient Portal

The patient portal allows registered patients to:

- Log in securely.
- Manage their profile information.
- Upload chest X-ray images.
- View their uploaded scans.
- Request AI-based pneumonia analysis.
- View predictions and confidence scores.
- Examine Grad-CAM heatmaps.
- Download authorized medical images.
- Generate and download digitally signed PDF reports.
- Verify report authenticity.
- Grant imaging access to doctors.
- Manage account settings and change passwords.

### 4.2 Doctor Portal

The doctor portal allows authorized doctors to:

- Access patient scans for which permission has been granted.
- View chest X-ray images.
- Review AI-generated predictions and confidence scores.
- Examine Grad-CAM visualizations.
- Download authorized images and reports.
- Add clinical reviews and observations.
- View previous scan and prediction history.
- Verify digitally signed reports.
- Manage their account settings.

Doctor observations are maintained separately from the original signed reports to preserve report integrity.

### 4.3 Administrator Portal

The administrator portal provides administrative and security-monitoring capabilities.

Administrators can:

- Access the administrative dashboard.
- View system statistics.
- Create doctor accounts.
- Monitor backend and database connectivity.
- Review recorded audit events.
- Filter audit records.
- Verify the integrity of the audit hash chain.

Administrative access is restricted through role-based authorization.

## 5. System Architecture

MedSecure AI follows a modular full-stack architecture.

```text
                  MedSecure AI
                        |
              React + Vite Frontend
                        |
                 REST API Requests
                        |
                 FastAPI Backend
                        |
       +----------------+----------------+
       |                |                |
 Authentication    Medical Imaging   Security Layer
 and RBAC           and AI Analysis   and Audit
       |                |                |
       |           DenseNet121           |
       |             Grad-CAM            |
       |                |                |
       +----------------+----------------+
                        |
                 PostgreSQL
                        |
             Encrypted File Storage
                        |
            Signed PDF Report System
```

### Architecture Components

**Frontend:** React provides a responsive interface for patients, doctors, and administrators.

**Backend:** FastAPI handles authentication, authorization, image management, AI inference, report generation, and audit logging.

**Database:** PostgreSQL stores user information, permissions, image metadata, predictions, report records, and audit events.

**Machine Learning:** DenseNet121 analyzes chest X-ray images and generates pneumonia classification predictions.

**Security:** AES-256-GCM, RSA-OAEP, RSA-PSS, SHA-256, and role-based authorization protect different parts of the application.

**Storage:** Uploaded medical images and generated reports are protected using encrypted file storage.

## 6. Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React.js, Vite, JavaScript, CSS |
| Backend | Python, FastAPI |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| Database migrations | Alembic |
| Deep learning | PyTorch, Torchvision |
| AI architecture | DenseNet121 |
| Explainable AI | Grad-CAM |
| Image processing | Pillow and related Python libraries |
| Image encryption | AES-256-GCM |
| Key protection | RSA-OAEP |
| Digital signatures | RSA-PSS with SHA-256 |
| Authentication | JWT |
| Password hashing | Argon2id |
| PDF generation | ReportLab |
| Testing | Pytest |
| Version control | Git and GitHub |

## 7. Methodology and Working Process

The MedSecure AI workflow consists of several stages.

### Step 1: User Authentication

The user accesses the platform and logs in using valid credentials.

The backend authenticates the user and determines the assigned role.

Based on this role, the user is directed to the appropriate workspace.

Role-based authorization is enforced by the backend, not solely through frontend navigation.

### Step 2: Chest X-ray Upload

A patient selects a chest X-ray image and uploads it through the patient portal.

The backend validates the upload and processes it for secure storage.

The image is encrypted before being stored, while the database maintains the metadata needed to manage access and retrieval.

### Step 3: Secure Image Storage

The application uses AES-256-GCM to protect uploaded images.

AES-GCM provides confidentiality and authenticated encryption, allowing the system to detect unauthorized changes to encrypted data.

RSA-OAEP is used to wrap the encryption keys, providing an additional layer of key protection.

### Step 4: AI-Based Pneumonia Detection

When a patient or authorized doctor requests analysis, the backend retrieves and decrypts the image for processing.

The image is preprocessed and passed to the trained DenseNet121 model.

The model performs binary classification between:

- **NORMAL**
- **PNEUMONIA**

The application displays the prediction and associated model confidence.

The confidence score is a model output and should not automatically be interpreted as a calibrated probability of disease.

### Step 5: Explainable AI Using Grad-CAM

Grad-CAM (Gradient-weighted Class Activation Mapping) is used to visualize image regions that influence the model's prediction.

A heatmap is generated to indicate areas contributing to the selected classification.

This helps users inspect the model's behavior rather than receiving only a classification label.

Grad-CAM is an interpretability technique; it does not independently establish that the model has identified the correct clinical abnormality.

### Step 6: Medical Report Generation

After analysis, the application can generate a PDF report containing relevant patient, scan, and AI prediction information.

The report is digitally signed using RSA-PSS with SHA-256.

The resulting report is protected in encrypted storage.

Authorized users can download and verify the report through the application.

### Step 7: Doctor Review

A patient can grant a doctor access to their imaging records.

Once authorized, the doctor can inspect the X-ray, review the AI prediction, and submit clinical observations.

Physician reviews are stored separately from previously signed PDF reports.

This preserves the original report's integrity while supporting subsequent clinical review.

### Step 8: Security Audit Logging

Important application activities are recorded in audit logs.

The system uses SHA-256 hash chaining to link audit entries.

Each entry contributes to a chain of records that can be checked for unexpected modifications.

Administrators can inspect the audit events and run the application's integrity verification process.

## 8. Deep Learning Model — DenseNet121

### 8.1 Why DenseNet121?

DenseNet121 is a convolutional neural network architecture based on densely connected layers.

Unlike conventional convolutional architectures in which each layer primarily receives input from the preceding layer, DenseNet connects layers within dense blocks to earlier feature representations.

This supports feature reuse and gradient propagation.

DenseNet121 was selected for the project because it provides an established architecture for image classification and can be adapted through transfer learning.

### 8.2 Transfer Learning

The model uses ImageNet-pretrained weights as its initialization.

The classification component is adapted for the binary chest X-ray classification task.

The network is trained to distinguish between normal chest X-ray images and images labeled as pneumonia.

### 8.3 Model Training Configuration

The recorded model configuration includes:

| Parameter | Value |
|---|---|
| Model architecture | DenseNet121 |
| Initialization | ImageNet-pretrained |
| Classification task | Binary |
| Classes | NORMAL, PNEUMONIA |
| Training epochs | 5 |
| Random seed | 42 |
| Model version | densenet121-v1 |

### 8.4 Recorded Model Performance

The project's recorded evaluation includes the following classification results:

| Class | Precision | Recall | F1-score | Support |
|---|---:|---:|---:|---:|
| NORMAL | 0.9926 | 0.5769 | 0.7297 | 234 |
| PNEUMONIA | 0.7971 | 0.9974 | 0.8867 | 195 |

**Recorded overall accuracy: approximately 84.77%.**

These results demonstrate high pneumonia sensitivity on the evaluated data, but comparatively low recall for normal images.

This means the model identifies most pneumonia-labeled samples while incorrectly classifying a substantial number of normal samples as pneumonia.

The results are specific to the recorded evaluation setup and do not establish clinical generalizability.

### 8.5 Model Limitations

- The model was trained for a limited number of epochs.
- Performance may vary across hospitals, devices, populations, and imaging conditions.
- False-positive predictions remain an important concern.
- Model confidence has not been established as clinically calibrated.
- Grad-CAM provides visual explanations but does not guarantee clinically correct reasoning.
- The model has not undergone prospective clinical validation.

For these reasons, the AI component is intended for research and demonstration rather than autonomous diagnosis.

## 9. Security Implementation

Security is a central component of MedSecure AI.

### 9.1 AES-256-GCM Encryption

AES (Advanced Encryption Standard) is a symmetric encryption algorithm.

The application uses AES with a 256-bit key in Galois/Counter Mode.

AES-GCM provides:

- Confidentiality of encrypted medical files.
- Authentication of encrypted data.
- Detection of unauthorized ciphertext modification.

### 9.2 RSA-OAEP Key Wrapping

RSA-OAEP is used to protect the symmetric encryption keys associated with encrypted files.

This combines the efficiency of symmetric encryption for file contents with asymmetric cryptography for key protection.

### 9.3 RSA-PSS Digital Signatures

RSA-PSS is used with SHA-256 to digitally sign generated PDF reports.

A valid signature verification provides evidence that the signed content matches the signature and corresponding public key.

It does not mean that the report's medical conclusions have been independently verified.

### 9.4 Password Protection

User passwords are protected using Argon2id password hashing.

The application verifies passwords without needing to store them in plaintext.

### 9.5 JWT Authentication

JSON Web Tokens are used to authenticate API requests.

Protected endpoints require valid authentication and appropriate permissions.

### 9.6 Role-Based Access Control

The application defines three main roles:

| Role | Primary Access |
|---|---|
| Patient | Own medical images, predictions, reports, and permissions |
| Doctor | Authorized patient records and clinical review functions |
| Administrator | Administrative operations and security monitoring |

### 9.7 Tamper-Evident Audit Logs

Audit events are linked using SHA-256 hashes.

The system provides an audit verification mechanism that checks the integrity of the recorded chain.

Hash chaining supports tamper detection, but it does not independently guarantee immutability against all privileged attackers.

## 10. Database Design

PostgreSQL is used as the relational database.

The database stores information about:

- Registered users and their roles.
- Patient and doctor profiles.
- Patient-doctor access permissions.
- Uploaded X-ray metadata.
- Encryption metadata.
- AI prediction records.
- Generated medical reports.
- Digital signature records.
- Physician reviews.
- Authentication sessions.
- Security audit logs.

SQLAlchemy is used for database interaction, while Alembic manages schema migrations.

Medical image contents and generated report files are managed through encrypted file storage rather than being treated as ordinary plaintext database fields.

## 11. Application Modules

### Authentication Module

Handles registration, login, logout, session validation, password changes, and role-based authorization.

### Patient Management Module

Provides patient-specific image management, analysis requests, reports, and doctor access permissions.

### Doctor Management Module

Supports authorized medical image access, prediction review, and clinical observations.

### AI Analysis Module

Performs preprocessing, DenseNet121 inference, and Grad-CAM generation.

### Encryption Module

Encrypts and decrypts medical files using authenticated encryption and protected encryption keys.

### Report Management Module

Generates, signs, stores, downloads, and verifies PDF reports.

### Audit and Monitoring Module

Records security-sensitive events and provides administrative integrity verification.

## 12. Project Development Phases

The project was developed incrementally through the following phases:

| Phase | Implementation |
|---|---|
| Phase 1 | Project setup, backend, frontend, and database connectivity |
| Phase 2 | Authentication, user roles, and access control |
| Phase 3 | Encrypted chest X-ray storage |
| Phase 4 | DenseNet121 pneumonia prediction and Grad-CAM |
| Phase 5 | PDF report generation and digital signatures |
| Phase 6 | Security audit logging and monitoring |
| UI/UX refinement | Professional patient, doctor, and administrator portals |
| Clinical review integration | Physician observations and review workflow |
| Account management | Profile and password management |
| Phase 7 | Integration testing and final validation |

Each phase was integrated into the existing system before the final validation process.

## 13. Testing and Validation

The application underwent backend automated testing, frontend build verification, role-based workflow testing, and end-to-end validation.

### Recorded Testing Results

| Testing Stage | Result |
|---|---|
| Backend automated tests | 9 passed |
| Frontend production build | Passed |
| Authentication and RBAC | 8 checks passed |
| Patient imaging | 10 checks passed |
| Doctor access and physician review | 10 checks passed |
| PDF reports and digital signatures | 10 checks passed |
| Admin dashboard and audit logs | 12 checks passed |
| Final end-to-end validation | 16 checks passed |

**Total recorded manual validation checks: 66 passed.**

These checks covered the functionality of the integrated application in the development environment.

They should not be interpreted as independent security certification, medical-device approval, or clinical validation.

## 14. Key Features and Contributions

The main contribution of MedSecure AI is the integration of several technologies into a unified medical imaging workflow.

**AI-assisted analysis:** Uses DenseNet121 for pneumonia classification.

**Explainable predictions:** Integrates Grad-CAM visualizations with classification results.

**Encrypted medical records:** Protects medical images and reports using authenticated encryption.

**Cryptographically signed reports:** Supports verification of report authenticity and integrity.

**Role-based collaboration:** Allows patients to authorize doctors to access imaging records.

**Physician review:** Enables doctors to record clinical observations separately from AI predictions.

**Security monitoring:** Maintains tamper-evident audit records for administrative review.

**Integrated web application:** Connects the AI model, secure backend, database, and role-specific frontend.

## 15. Project Structure

The repository is organized around the following major components:

```text
medsecure-ai/
|
|-- backend/
|   |-- app/
|   |   |-- api/
|   |   |-- models/
|   |   |-- schemas/
|   |   |-- services/
|   |
|   |-- alembic/
|   |-- tests/
|
|-- frontend/
|   |-- src/
|   |-- public/
|
|-- ml/
|   |-- models/
|
|-- .gitignore
|-- README.md
```

This is a simplified architectural view. The exact directory structure may contain additional modules, configuration files, and scripts.

Sensitive files, private keys, environment variables, patient data, and large trained model checkpoints should not be included in the public repository.

## 16. Running the Project Locally

### Prerequisites

- Python
- Node.js and npm
- PostgreSQL
- Git
- Required backend and frontend dependencies
- Local environment configuration
- Required cryptographic keys
- Trained AI model weights for inference

### Backend

Navigate to the backend directory:

```bash
cd backend
```

Activate the Python virtual environment.

On Windows CMD:

```cmd
.venv\Scripts\activate.bat
```

Install dependencies using the backend dependency specification provided in the repository.

Configure the local PostgreSQL database, environment variables, encryption keys, and migrations according to the project setup.

Start the FastAPI server:

```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The API documentation is available at:

```text
http://127.0.0.1:8000/docs
```

### Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

The development frontend is typically available at:

```text
http://localhost:5173
```

### Testing

Run the backend tests:

```bash
cd backend
python -m pytest -x -q
```

Build the frontend:

```bash
cd frontend
npm run build
```

**Note:** The application requires correctly configured local secrets, database credentials, and AI model weights. These are intentionally not provided in the public repository. The commands above are not a complete zero-configuration deployment procedure.

## 17. Limitations

Although the system demonstrates the integration of AI and security technologies, several limitations remain.

1. **Clinical validation:** The pneumonia classifier has not been validated for clinical deployment.
2. **Dataset generalization:** Performance may vary when images originate from different hospitals or patient populations.
3. **False positives:** The recorded model evaluation shows comparatively weak recognition of normal images.
4. **Model calibration:** Confidence values should not be treated as clinically validated disease probabilities.
5. **Explainability:** Grad-CAM visualizations are approximations of model attention, not definitive clinical explanations.
6. **Security assurance:** The implementation has undergone application testing but not a comprehensive independent penetration test or cryptographic audit.
7. **Deployment:** The current project is a locally tested research prototype rather than a certified production healthcare service.

## 18. Future Scope

Potential future improvements include:

- Training and evaluating the model on larger, more diverse datasets.
- Improving specificity and reducing false-positive predictions.
- Performing probability calibration and external model validation.
- Supporting additional chest X-ray findings.
- Evaluating more advanced explainable AI methods.
- Conducting independent security assessments.
- Introducing deployment monitoring and operational safeguards.
- Assessing clinical usability with qualified medical professionals.

These are possible research directions and are not part of the completed implementation.

## 19. Conclusion

MedSecure AI demonstrates how artificial intelligence and modern security mechanisms can be integrated into a healthcare-oriented web application.

The system combines DenseNet121-based pneumonia detection, Grad-CAM visualization, encrypted medical image storage, digitally signed PDF reports, patient-doctor authorization, clinical review functionality, and security audit logging.

By connecting these components through a FastAPI backend, React frontend, and PostgreSQL database, the project provides a functional prototype of a secure AI-assisted medical imaging platform.

The project highlights an important principle: developing AI for healthcare involves not only predictive modeling but also data protection, access control, explainability, integrity, and accountability.

**MedSecure AI is intended as a foundation for further research and technical development, not as a clinically approved diagnostic product.**

---

## 20. Repository

**GitHub:** https://github.com/dhwani040906/ISC_Project_medsecure-ai

**Project:** MedSecure AI — AI-Powered Pneumonia Detection and Secure Medical Record Management System

**Project Type:** Academic / Research Prototype

**Status:** Development and planned local validation completed

---

*MedSecure AI — Combining Artificial Intelligence, Medical Imaging, and Cryptographic Security.*