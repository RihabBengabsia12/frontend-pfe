"""
Router FastAPI — Matching Phase 3 (RAG).
Extraction des exigences et génération de la matrice de différenciation.
"""

from fastapi import APIRouter, HTTPException

from models.generation_request import MatchingRequest, ExpertMatchRequest
from services import matching_analysis_service, diff_matrix_service

router = APIRouter()


@router.post("/extract-requirements")
def extract_requirements(req: MatchingRequest) -> dict:
    """
    Extrait les exigences structurées depuis le TDR :
    références requises, qualifications, profils experts.
    Résultat utilisé par analyste-service pour le matching avec le référentiel.
    """
    if not req.document_text.strip():
        raise HTTPException(status_code=400, detail="document_text est vide")
    try:
        from services.claude_client import fetch_dossier_overrides
        req.custom_prompts = fetch_dossier_overrides(req.dossier_id)
        return matching_analysis_service.extract_requirements(req)
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=502, detail=f"Erreur extraction exigences: {e}")


@router.post("/generate-matrix")
def generate_matrix(matching_result: dict) -> dict:
    """
    Génère la matrice de différenciation depuis le résultat de matching.
    Body: {dossier_id, ...matching_result}
    Retourne: {"dossier_id": "...", "matrice": [{critere, position, argument}]}
    """
    dossier_id = matching_result.get("dossier_id") or matching_result.get("dossierId", "")
    if not dossier_id:
        raise HTTPException(status_code=400, detail="dossier_id manquant")
    try:
        from services.claude_client import fetch_dossier_overrides
        custom_prompts = matching_result.get("custom_prompts") or fetch_dossier_overrides(dossier_id)
        matrice, metrics = diff_matrix_service.generate_diff_matrix(matching_result, dossier_id, custom_prompts)
        return {"dossier_id": dossier_id, "lignes": matrice, **metrics}
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=502, detail=f"Erreur génération matrice: {e}")
@router.post("/match-experts")
def match_experts(req: ExpertMatchRequest) -> list[dict]:
    from services import expert_matching_service
    return expert_matching_service.match_experts(req)

