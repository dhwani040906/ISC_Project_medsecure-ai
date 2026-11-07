# MedSecure AI — Phase 4 (DenseNet121 + Grad-CAM)

This update **merges** into the Phase 1–3 project. Do not delete existing code, migrations, keys, `.env`, or encrypted images.

## Files in this update

- `backend/app/ml/inference.py`: checkpoint loading, preprocessing, DenseNet121 inference, Grad-CAM
- `backend/app/api/analysis.py`: authorization, authenticated decryption, inference, audit, history
- `backend/app/core/config.py`: adds `pneumonia_model_path` setting
- `backend/app/main.py`: registers new analysis router
- `backend/tests/test_analysis.py`: permission, integrity, persistence, and mocked-inference tests
- `backend/requirements-phase4.txt`: Python ML packages
- `ml/training/train.py`: training/validation/test pipeline and evaluation metrics
- `frontend/src/App.jsx`: analysis controls and Grad-CAM display

## Install

Open CMD in `medsecure-ai/backend` with your existing `.venv` activated:

```cmd
python -m pip install -r requirements-phase4.txt
```

On Windows/CPU, PyTorch may be a large download. For a specific CPU wheel use the official PyTorch installation selector: https://pytorch.org/get-started/locally/ . Do not install an arbitrary CUDA wheel.

## Data preparation

Use a licensed dataset with **patient-level separation**. Images from one patient must not appear in multiple splits. Confirm dataset provenance and that labels are trustworthy. Do not use real patient data without permission and appropriate safeguards.

Expected directory layout:

```
ml/dataset/chest_xray/
  train/NORMAL/*.jpeg
  train/PNEUMONIA/*.jpeg
  val/NORMAL/*.jpeg
  val/PNEUMONIA/*.jpeg
  test/NORMAL/*.jpeg
  test/PNEUMONIA/*.jpeg
```

If using the commonly circulated Kaggle chest X-ray pneumonia dataset, its existing split sizes and potential patient overlap should be audited. Do not claim patient-level independence without verifying patient identifiers. A tiny validation split is not sufficient for robust model selection.

## Train

From `medsecure-ai/backend`:

```cmd
python ..\ml\training\train.py --data ..\ml\dataset\chest_xray --epochs 5 --batch-size 8 --pretrained
```

`--pretrained` downloads ImageNet weights on first use; internet access required. Omit it to train from random initialization, which usually requires substantially more data and training. On CPU, DenseNet121 training can take hours. For initial pipeline smoke tests, use `--epochs 1`, but do not treat the resulting checkpoint as useful medically.

Outputs:

```
ml/models/densenet121_pneumonia.pt
ml/models/densenet121_pneumonia.json
```

The JSON contains class mapping, training configuration, test confusion matrix, per-class precision/recall/F1 and ROC-AUC when both classes exist. The test set is evaluated only after model selection on validation loss. No fixed accuracy is guaranteed.

## Configure

`backend/.env` retains all existing values. Add only if the default path differs:

```dotenv
PNEUMONIA_MODEL_PATH=../ml/models/densenet121_pneumonia.pt
```

## Database

Phase 1 created `predictions`, so no new migration should be needed:

```cmd
python -m alembic check
```

If unexpected changes appear, stop and inspect them; do not blindly apply a migration.

## Run

Backend:

```cmd
python -m uvicorn app.main:app --reload
```

Frontend, separate terminal:

```cmd
cd ..\frontend
npm run dev
```

Use an authenticated patient account to upload a synthetic image. Click **Analyze (research)**. The response displays a label, model scores and an in-memory Grad-CAM PNG. A doctor must first be granted access by the patient. Admin accounts cannot analyze medical images by default.

API:
- `POST /api/analysis/{record_id}` — authorized analysis
- `GET /api/analysis/{record_id}/history` — authorized prediction history

For both, send `Authorization: Bearer <access_token>`. The analyze endpoint responds with `gradcam_png_base64` (potentially large) and probabilities. It does not save the overlay on disk. Audit events are stored for successful analysis, denied access and integrity failures.

## Tests

```cmd
python -m pytest -q
```

Expected for the supplied Phase 1–4 suite in the reference environment: **6 passed**. The new test mocks the neural network so it validates API integration, access control and encryption without requiring trained weights. This does **not** establish model accuracy or real-world safety.

## Security / limitations

- Research prototype, **not** a clinical diagnosis or medical device.
- Scores are softmax outputs, not calibrated probabilities of disease.
- Grad-CAM is a model explanation, not a validated lesion segmentation or proof of causality.
- Inference is synchronous and CPU-intensive; add a bounded job queue, concurrency limits and operational timeouts for deployment.
- The frontend displays the Grad-CAM as a data URI in memory; browser/devtools can access it while displayed. Do not cache sensitive responses or send them to analytics.
- No pretrained or trained weights are bundled. A real dataset and evaluation are necessary.
- Store weights securely and pin their checksum in production. Avoid loading untrusted model files.
- `torch.load(..., weights_only=True)` is used for checkpoint loading.
