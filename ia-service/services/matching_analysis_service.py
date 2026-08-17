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
    Retourne un dict comparé ensuite avec le référentiel notre cabinet.
    """
    custom = req.custom_prompts.get("prompt_extract_requirements.txt") if req.custom_prompts else None
    system_prompt = custom if custom else load_prompt("prompt_extract_requirements.txt")

    if req.referentiel:
        ref_summary = json.dumps(req.referentiel, ensure_ascii=False)[:3000]
        user_prompt = (
            f"RÉFÉRENTIEL notre cabinet (résumé) :\n{ref_summary}\n\n"
            f"Analyse le document fourni pour en extraire les exigences."
        )
    else:
        user_prompt = "Analyse le document fourni pour en extraire les exigences."

    try:
        # Activation du Prompt Caching : on passe le document_text entier
        result, metrics = call_claude_json(system_prompt, user_prompt, document_text=req.document_text)
    except ValueError as e:
        logger.error("Extraction exigences matching échouée: %s", e)
        raise

    # Mapping for Java DTO RequirementsResponseDto
    # Le prompt utilise le contrat JSON du backend Java (camelCase). On accepte
    # aussi le snake_case historique afin de rester compatible avec d'anciens prompts.
    refs = result.get("refsExigees", result.get("refs_exigees", []))
    if isinstance(refs, list):
        mapped_refs = [r.get("description", str(r)) if isinstance(r, dict) else str(r) for r in refs]
    else:
        mapped_refs = []

    qualifs = result.get("qualifsExigees", result.get("qualifs_exigees", []))
    if isinstance(qualifs, list):
        mapped_qualifs = [q.get("qualification", str(q)) if isinstance(q, dict) else str(q) for q in qualifs]
    else:
        mapped_qualifs = []

    experts = result.get("expertsRequis", result.get("experts_requis", []))
    mapped_experts = []
    if isinstance(experts, list):
        for e in experts:
            if isinstance(e, dict):
                # Format actuel : {role, qualifications, dureeMois}.
                # Format historique : {titre, specialites, hm_mission}.
                specs = e.get("qualifications", e.get("specialites", ""))
                qual_str = ", ".join(specs) if isinstance(specs, list) else str(specs or "")
                mapped_experts.append({
                    "role": e.get("role", e.get("titre", "")),
                    "qualifications": qual_str,
                    "dureeMois": e.get("dureeMois", e.get("hm_mission"))
                })

    secteur_obj = result.get("secteurDetecte", result.get("secteur_ao"))
    secteur_str = secteur_obj.get("valeur", "") if isinstance(secteur_obj, dict) else str(secteur_obj or "")

    type_contrat_obj = result.get("typeContrat", result.get("type_contrat"))
    type_contrat_str = type_contrat_obj.get("valeur", "") if isinstance(type_contrat_obj, dict) else str(type_contrat_obj or "")

    cond_resil_obj = result.get("conditions_resiliation")
    cond_resil_str = cond_resil_obj.get("valeur", "") if isinstance(cond_resil_obj, dict) else str(cond_resil_obj or "")

    return {
        "dossier_id":          req.dossier_id,
        "refsExigees":         mapped_refs,
        "qualifsExigees":      mapped_qualifs,
        "expertsRequis":       mapped_experts,
        "secteurDetecte":      secteur_str,
        "typeContrat":         type_contrat_str,
        "conditionsResiliation": cond_resil_str,
        **metrics
    }
