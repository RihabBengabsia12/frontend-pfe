"""
Router FastAPI — Scoring et rapport No-Go.
Le calcul P-Win lui-même est fait en Java (ScoringService).
Ce router génère le rapport narratif No-Go.
"""

from fastapi import APIRouter, HTTPException

from models.extraction_request import NoGoReportRequest
from services import nogo_report_service

router = APIRouter()


@router.post("/nogo-report")
def generate_nogo_report(req: NoGoReportRequest) -> dict:
    """
    Génère le rapport No-Go narratif (200-300 mots).
    Appelé par analyste-service quand P-Win < seuil ou risque Rédhibitoire confirmé.
    Retourne: {"rapport": "texte narratif..."}
    """
    try:
        rapport_dict = nogo_report_service.generate_nogo_report(req)
        rapport_dict["dossier_id"] = req.dossier_id
        return rapport_dict
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=502, detail=f"Erreur génération No-Go: {e}")