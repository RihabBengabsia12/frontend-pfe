"""
Router FastAPI — Génération Phase 4 (textes APO, méthodologie, checklist).
"""

from fastapi import APIRouter, HTTPException

from models.generation_request import (
    ApoGenerationRequest,
    MethodologieRequest,
    ChecklistRequest,
)
from services import apo_generation_service, methodologie_service, checklist_service

router = APIRouter()


@router.post("/apo-texts")
def generate_apo_texts(req: ApoGenerationRequest) -> dict:
    """
    Génère tous les champs textuels APO :
    RESUME_CONTEXTE, POINTS_CRITIQUES, RECOMMANDATION_GO_NOGO,
    ARGUMENTAIRE_GO_NOGO, LISTE_CLARIFICATIONS.
    Résultats injectés dans ApoData côté analyste-service.
    """
    try:
        from services.claude_client import fetch_dossier_overrides
        req.custom_prompts = fetch_dossier_overrides(req.dossier_id)
        texts = apo_generation_service.generate_apo_texts(req)
        return {"dossier_id": req.dossier_id, **texts}
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=502, detail=f"Erreur génération textes APO: {e}")


@router.post("/methodologie")
def generate_methodologie(req: MethodologieRequest) -> dict:
    """
    Génère la méthodologie structurée en 5 sections.
    Injectée dans Methodologie-Template.docx via Apache POI.
    """
    if not req.document_text.strip():
        raise HTTPException(status_code=400, detail="document_text est vide")
    try:
        from services.claude_client import fetch_dossier_overrides
        req.custom_prompts = fetch_dossier_overrides(req.dossier_id)
        sections = methodologie_service.generate_methodologie(req)
        return {"dossier_id": req.dossier_id, **sections}
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=502, detail=f"Erreur génération méthodologie: {e}")


@router.post("/checklist")
def generate_checklist(req: ChecklistRequest) -> dict:
    """
    Génère la checklist des pièces administratives selon le bailleur.
    Logique déterministe (pas d'appel Claude — instantané).
    """
    if not req.bailleur.strip():
        raise HTTPException(status_code=400, detail="bailleur est requis")
    return checklist_service.generate_checklist(req)