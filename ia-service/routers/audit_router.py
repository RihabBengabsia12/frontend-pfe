"""
Router FastAPI — Rapport d'audit Phase 6.
"""

from fastapi import APIRouter, HTTPException

from models.generation_request import AuditReportRequest
from services import audit_report_service

router = APIRouter()


@router.post("/audit-report")
def generate_audit_report(req: AuditReportRequest) -> dict:
    """
    Génère le rapport d'audit narratif du cycle de vie du dossier.
    Appelé par analyste-service après que le dossier passe en statut AUDIT.
    Retourne: {"dossier_id": "...", "rapport": "texte structuré 350-450 mots"}
    """
    if not req.audit_entries:
        raise HTTPException(status_code=400, detail="audit_entries est vide — rien à auditer")
    try:
        rapport_dict = audit_report_service.generate_audit_report(req)
        rapport_dict["dossier_id"] = req.dossier_id
        return rapport_dict
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=502, detail=f"Erreur génération rapport audit: {e}")