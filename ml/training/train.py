"""Train DenseNet121 on split folders: train|val|test/NORMAL|PNEUMONIA.

Usage (from backend directory): python ../ml/training/train.py --data ../ml/dataset/chest_xray --epochs 5
Use patient-level splits; do not place images from the same patient in multiple splits.
"""
import argparse
import json
import random
import sys
from pathlib import Path
import numpy as np

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--data',type=Path,required=True)
    parser.add_argument('--output',type=Path,default=Path('../ml/models/densenet121_pneumonia.pt'))
    parser.add_argument('--epochs',type=int,default=5)
    parser.add_argument('--batch-size',type=int,default=8)
    parser.add_argument('--lr',type=float,default=1e-4)
    parser.add_argument('--seed',type=int,default=42)
    parser.add_argument('--pretrained',action='store_true',help='Download ImageNet weights (internet required)')
    args=parser.parse_args()
    import torch
    from torch import nn
    from torch.utils.data import DataLoader
    from torchvision import datasets, models, transforms
    from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
    random.seed(args.seed); np.random.seed(args.seed); torch.manual_seed(args.seed)
    train_transform=transforms.Compose([transforms.Resize((224,224)),transforms.RandomRotation(5),transforms.ToTensor(),transforms.Normalize([0.485,0.456,0.406],[0.229,0.224,0.225])])
    eval_transform=transforms.Compose([transforms.Resize((224,224)),transforms.ToTensor(),transforms.Normalize([0.485,0.456,0.406],[0.229,0.224,0.225])])
    datasets_by_split={s:datasets.ImageFolder(args.data/s,transform=train_transform if s=='train' else eval_transform) for s in ('train','val','test')}
    for s,ds in datasets_by_split.items():
        if ds.class_to_idx != {'NORMAL':0,'PNEUMONIA':1}: raise SystemExit(f'Invalid classes in {s}: {ds.class_to_idx}')
        if not ds.samples: raise SystemExit(f'Empty split: {s}')
    loaders={s:DataLoader(ds,batch_size=args.batch_size,shuffle=(s=='train'),num_workers=0) for s,ds in datasets_by_split.items()}
    device=torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    weights=models.DenseNet121_Weights.DEFAULT if args.pretrained else None
    model=models.densenet121(weights=weights)
    model.classifier=nn.Linear(model.classifier.in_features,2)
    model.to(device)
    optimizer=torch.optim.AdamW(model.parameters(),lr=args.lr)
    criterion=nn.CrossEntropyLoss()
    best_loss=float('inf'); best_state=None
    for epoch in range(args.epochs):
        model.train(); running=0.; n=0
        for x,y in loaders['train']:
            x,y=x.to(device),y.to(device); optimizer.zero_grad(set_to_none=True)
            loss=criterion(model(x),y); loss.backward(); optimizer.step()
            running+=loss.item()*len(y);n+=len(y)
        model.eval(); vl=0.;vn=0
        with torch.no_grad():
            for x,y in loaders['val']:
                x,y=x.to(device),y.to(device);loss=criterion(model(x),y)
                vl+=loss.item()*len(y);vn+=len(y)
        val_loss=vl/vn
        print(f'Epoch {epoch+1}/{args.epochs}: train_loss={running/n:.4f}, val_loss={val_loss:.4f}',flush=True)
        if val_loss<best_loss:
            best_loss=val_loss;best_state={k:v.detach().cpu().clone() for k,v in model.state_dict().items()}
    model.load_state_dict(best_state);model.to(device);model.eval()
    truth=[]; predicted=[]; scores=[]
    with torch.no_grad():
        for x,y in loaders['test']:
            prob=torch.softmax(model(x.to(device)),dim=1)[:,1].cpu().numpy()
            truth.extend(y.numpy().tolist());scores.extend(prob.tolist());predicted.extend((prob>=0.5).astype(int).tolist())
    metrics={'classification_report':classification_report(truth,predicted,target_names=['NORMAL','PNEUMONIA'],output_dict=True,zero_division=0),'confusion_matrix':confusion_matrix(truth,predicted,labels=[0,1]).tolist(),'test_samples':len(truth),'test_roc_auc':roc_auc_score(truth,scores) if len(set(truth))==2 else None}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    torch.save(best_state,args.output)
    meta={'model_version':'densenet121-v1','class_to_idx':{'NORMAL':0,'PNEUMONIA':1},'architecture':'densenet121','pretrained_imagenet':args.pretrained,'seed':args.seed,'epochs':args.epochs,'validation_loss':best_loss,'test_metrics':metrics,'warning':'Research only. Dataset and patient-level split must be independently verified.'}
    args.output.with_suffix('.json').write_text(json.dumps(meta,indent=2),encoding='utf-8')
    print('Saved:',args.output,'\nTest metrics:',json.dumps(metrics,indent=2))
if __name__=='__main__': main()
