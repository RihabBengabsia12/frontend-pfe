from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os
import shutil
import json
from datetime import datetime
from pathlib import Path

# Import de ton pipeline
try:
    from main import traiter_dp 
except ImportError:
    print("Erreur : Assure-toi que main.py est dans le même dossier que api.py")

app = FastAPI(title="ProjectIQ API")

# --- CONFIGURATION CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

# Configuration des dossiers
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "Uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

@app.post("/api/extract-apo")
async def extract_apo_endpoint(file: UploadFile = File(...)):
    # 1. Sauvegarde du PDF
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    temp_pdf_path = UPLOAD_DIR / f"{ts}_{file.filename}"
    
    try:
        with open(temp_pdf_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 2. Lancement du pipeline
        # On passe la version string du chemin pour ton script
        resultat = traiter_dp(str(temp_pdf_path))
        
        if not resultat.get("succes"):
            raise HTTPException(status_code=500, detail=resultat.get("erreur", "Erreur inconnue"))
            
        # 3. Lecture du JSON pour le Frontend
        with open(resultat["json_path"], "r", encoding="utf-8") as f:
            data_json = json.load(f)
            
        # 4. Réponse structurée pour Angular
        return {
            "succes": True,
            "data": data_json,
            # On passe juste le nom du fichier ou un ID pour les endpoints de téléchargement
            "docx_path": resultat['docx_path'],
            "json_path": resultat['json_path']
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur Serveur: {str(e)}")

@app.get("/api/download")
async def download_file(path: str = Query(...)):
    """
    Endpoint unique pour télécharger DOCX ou JSON via leur chemin.
    Sécurité : On vérifie que le fichier existe.
    """
    file_path = Path(path)
    if file_path.exists():
        # Déterminer le type de contenu
        content_type = 'application/json' if file_path.suffix == '.json' else 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        
        return FileResponse(
            path=file_path, 
            media_type=content_type, 
            filename=file_path.name
        )
    
    raise HTTPException(status_code=404, detail="Fichier introuvable sur le serveur")