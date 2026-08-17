"""
Génération de la méthodologie structurée en 5 sections.
Injectée dans Methodologie-Template.docx via Apache POI côté Java.
"""

import logging
import json
from models.generation_request import MethodologieRequest
from services.claude_client    import call_claude_json, load_prompt

logger = logging.getLogger(__name__)


def generate_methodologie(req: MethodologieRequest) -> dict:
    """
    Retourne un dict avec 5 sections :
    {
      "SECTION1_COMPREHENSION": "...",
      "SECTION2_METHODOLOGIE":  "...",
      "SECTION3_PLAN_TRAVAIL":  "...",
      "SECTION4_EQUIPE":        "...",
      "SECTION5_REFERENCES":    "...",
    }
    Chaque section est un texte HTML-ready (paragraphes séparés par \\n\\n).
    """
    custom = req.custom_prompts.get("prompt_methodologie.txt") if req.custom_prompts else None
    system_prompt = custom if custom else load_prompt("prompt_methodologie.txt")

    req_dict = req.dict() if hasattr(req, "dict") else {}
    matrice_fmt = json.dumps(req.matrice_diff, ensure_ascii=False)[:2000] if req.matrice_diff else "{}"
    matching_result = req_dict.get("matching_result", {})
    matching_fmt = json.dumps(matching_result, ensure_ascii=False)[:2000] if matching_result else "{}"
    champs_p1 = req_dict.get("champs_p1", {})
    champs_fmt  = json.dumps(champs_p1, ensure_ascii=False)[:1000] if champs_p1 else "{}"

    user_prompt = (
        f"CHAMPS DOSSIER (Phase 1) :\n{champs_fmt}\n\n"
        f"RÉSULTAT MATCHING :\n{matching_fmt}\n\n"
        f"MATRICE DIFFÉRENCIATION :\n{matrice_fmt}\n\n"
        f"EXTRAIT TDR :\n{req.document_text[:8000]}\n\n"
        f"Génère la méthodologie complète en 5 sections JSON."
    )

    try:
        raw, stats = call_claude_json(system_prompt, user_prompt, max_tokens=8192)
    except ValueError as e:
        logger.error("Génération méthodologie échouée: %s", e)
        raise

    result = {
        "SECTION1_COMPREHENSION": raw.get("section1", ""),
        "SECTION2_METHODOLOGIE":  raw.get("section2", ""),
        "SECTION3_PLAN_TRAVAIL":  raw.get("section3", ""),
        "SECTION4_EQUIPE":        raw.get("section4", ""),
        "SECTION5_REFERENCES":    raw.get("section5", ""),
    }
    
    if stats:
        result["stats"] = stats
        
    return result