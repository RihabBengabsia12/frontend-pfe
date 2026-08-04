"""
Extraction des exigences de matching depuis le TDR (Phase 3 — RAG).
Claude extrait les références requises, qualifications et profils experts.
"""

import logging
import json
from models.generation_request import MatchingRequest
from services.claude_client    import call_claude_json, load_prompt

logger = logging.getLogger(__name__)


def extract_requirements(req: MatchingRequest) -> dict:
    """
    Extrait depuis le TDR les exigences structurées :
    - références similaires requises
    - qualifications/certifications exigées
    - profils experts recherchés
    Retourne un dict comparé ensuite avec le référentiel Egis.
    """
    system_prompt = req.custom_prompt if req.custom_prompt else load_prompt("prompt_extract_requirements.txt")

    ref_summary = json.dumps(req.referentiel, ensure_ascii=False)[:3000]
    user_prompt = (
        f"RÉFÉRENTIEL EGIS (résumé) :\n{ref_summary}\n\n"
        f"Analyse le document fourni pour en extraire les exigences."
    )

    try:
        # Activation du Prompt Caching : on passe le document_text entier
        result = call_claude_json(system_prompt, user_prompt, document_text=req.document_text)
    except ValueError as e:
        logger.error("Extraction exigences matching échouée: %s", e)
        raise

    return {
        "dossier_id":          req.dossier_id,
        "refs_exigees":        result.get("refs_exigees", []),
        "qualifs_exigees":     result.get("qualifs_exigees", []),
        "experts_requis":      result.get("experts_requis", []),
        "secteur_ao":          result.get("secteur_ao", ""),
        "type_contrat":        result.get("type_contrat", ""),
        "conditions_resiliation": result.get("conditions_resiliation", ""),
    }