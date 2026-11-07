"""Inference only; checkpoint must be trained and validated separately."""
import io
import json
from functools import lru_cache
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps

DISCLAIMER = "Research-only output; not a medical diagnosis. Seek qualified clinical review."

def _dependencies():
    import torch
    from torchvision import models, transforms
    return torch, models, transforms

@lru_cache(maxsize=1)
def load_model():
    torch, models, transforms = _dependencies()
    from app.core.config import get_settings
    path = Path(get_settings().pneumonia_model_path).resolve()
    manifest = path.with_suffix('.json')
    if not path.is_file() or not manifest.is_file():
        raise FileNotFoundError('No trained model/manifest. Run ml/train.py and configure PNEUMONIA_MODEL_PATH.')
    meta = json.loads(manifest.read_text(encoding='utf-8'))
    if meta.get('class_to_idx') != {'NORMAL': 0, 'PNEUMONIA': 1}:
        raise ValueError('Unsupported class mapping')
    model = models.densenet121(weights=None)
    model.classifier = torch.nn.Linear(model.classifier.in_features, 2)
    state = torch.load(path, map_location='cpu', weights_only=True)
    model.load_state_dict(state, strict=True)
    model.eval()
    return model, meta

def prepare_image(raw):
    _, _, transforms = _dependencies()
    with Image.open(io.BytesIO(raw)) as img:
        img = ImageOps.exif_transpose(img).convert('RGB')
        img.load()
        # Same normalization as training. No random augmentation during inference.
        pipeline = transforms.Compose([transforms.Resize((224,224)), transforms.ToTensor(), transforms.Normalize([0.485,0.456,0.406],[0.229,0.224,0.225])])
        return pipeline(img).unsqueeze(0), img

def analyze_image(raw: bytes):
    """Return class probabilities and an in-memory PNG Grad-CAM overlay."""
    torch, _, _ = _dependencies()
    model, meta = load_model()
    x, source = prepare_image(raw)
    layer = model.features.denseblock4
    activations, gradients = [], []
    def capture(_, __, output):
        activations.append(output)
        output.register_hook(lambda grad: gradients.append(grad))
    hook = layer.register_forward_hook(capture)
    try:
        with torch.enable_grad():
            logits = model(x)
            probs = torch.softmax(logits, dim=1)[0]
            chosen = int(probs.argmax().item())
            model.zero_grad(set_to_none=True)
            logits[0, chosen].backward()
        if not activations or not gradients:
            raise RuntimeError('Grad-CAM hooks did not capture tensors')
        a, g = activations[0].detach(), gradients[0].detach()
        weights = g.mean(dim=(2,3), keepdim=True)
        cam = torch.relu((weights*a).sum(dim=1,keepdim=True))
        cam = torch.nn.functional.interpolate(cam, size=(224,224), mode='bilinear', align_corners=False)[0,0]
        cam = cam - cam.min()
        cam = cam / cam.max().clamp_min(1e-8)
        intensity = (cam.numpy()*255).astype(np.uint8)
        heat = Image.fromarray(intensity, mode='L').resize(source.size, Image.Resampling.BILINEAR)
        heat_rgb = Image.merge('RGB', (heat, Image.new('L',heat.size,0),Image.new('L',heat.size,0)))
        overlay = Image.blend(source,heat_rgb,alpha=0.35)
        out = io.BytesIO(); overlay.save(out, format='PNG')
        return {'label': ['NORMAL','PNEUMONIA'][chosen], 'confidence':float(probs[chosen].item()), 'probabilities': {'NORMAL':float(probs[0].item()),'PNEUMONIA':float(probs[1].item())}, 'model_version':str(meta['model_version']), 'disclaimer':DISCLAIMER}, out.getvalue()
    finally:
        hook.remove()
