"""
Router FastAPI — Extraction Phase 1 et Phase 2.
Endpoints : /extract/phase1  /extract/phase2  /extract/refield  /extract/risks
"""

from fastapi import APIRouter, HTTPException

from models.extraction_request  import ExtractionRequest, ReextractFieldRequest, RiskAnalysisRequest
from models.extraction_response import ExtractionResponse, RiskAnalysisResponse, ChampExtraitIA
from services import extraction_p1_service, extraction_p2_service, risk_analysis_service

router = APIRouter()


@router.post("/phase1", response_model=ExtractionResponse)
def extract_phase1(req: ExtractionRequest):
    """
    Extraction des 12 champs bloquants Phase 1 depuis le texte du TDR/AP.
    Déclenché automatiquement par project-service via RabbitMQ après upload.
    """
    if not req.document_text.strip():
        raise HTTPException(status_code=400, detail="document_text est vide")
    try:
        from services.claude_client import fetch_dossier_overrides
        req.custom_prompts = fetch_dossier_overrides(req.dossier_id)
        return extraction_p1_service.extract_phase1(req)
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=502, detail=f"Erreur extraction P1: {e}")


@router.post("/phase2", response_model=ExtractionResponse)
def extract_phase2(req: ExtractionRequest):
    """
    Extraction des 20+ champs Phase 2 : notation, caution, délais, financement local.
    Déclenché par analyste-service quand le dossier passe en DEEP_ANALYSIS.
    """
    if not req.document_text.strip():
        raise HTTPException(status_code=400, detail="document_text est vide")
    try:
        from services.claude_client import fetch_dossier_overrides
        req.custom_prompts = fetch_dossier_overrides(req.dossier_id)
        return extraction_p2_service.extract_phase2(req)
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=502, detail=f"Erreur extraction P2: {e}")


@router.post("/refield", response_model=ExtractionResponse)
def reextract_field(req: ReextractFieldRequest):
    """
    Ré-extraction ciblée d'un seul champ (bouton '↻ Ré-extraire' dans l'UI).
    Limité à 2 tentatives par champ côté analyste-service.
    IMPORTANT: Retourne une ExtractionResponse (avec map champs) et non un ChampExtraitIA seul,
    pour que project-service puisse appeler .getChamps().get(fieldName).
    """
    if not req.document_text.strip():
        raise HTTPException(status_code=400, detail="document_text est vide")
    if not req.field_name.strip():
        raise HTTPException(status_code=400, detail="field_name est requis")
    try:
        from services.claude_client import fetch_dossier_overrides
        req.custom_prompts = fetch_dossier_overrides(req.dossier_id)
        champ, metrics = extraction_p1_service.reextract_field(req)
        return ExtractionResponse(
            dossier_id=req.dossier_id,
            champs={req.field_name: champ},
            alertes=[],
            token_usage=metrics["token_usage"],
            processing_time_ms=metrics["processing_time_ms"],
            estimated_cost=metrics["estimated_cost"],
            cache_creation_tokens=metrics.get("cache_creation_tokens", 0),
            cache_read_tokens=metrics.get("cache_read_tokens", 0)
        )
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=502, detail=f"Erreur ré-extraction: {e}")


@router.post("/risks", response_model=RiskAnalysisResponse)
def analyze_risks(req: RiskAnalysisRequest):
    """
    Analyse des 10 risques rédhibitoires.
    Claude propose un niveau (Faible/Modéré/Élevé/Rédhibitoire) + justification.
    L'humain valide/corrige dans l'interface Angular.
    """
    if not req.document_text.strip():
        raise HTTPException(status_code=400, detail="document_text est vide")
    try:
        from services.claude_client import fetch_dossier_overrides
        req.custom_prompts = fetch_dossier_overrides(req.dossier_id)
        return risk_analysis_service.analyze_risks(req)
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=502, detail=f"Erreur analyse risques: {e}")