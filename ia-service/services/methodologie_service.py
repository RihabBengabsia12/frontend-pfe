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
    system_prompt = req.custom_prompt if req.custom_prompt else load_prompt("prompt_methodologie.txt")

    matrice_fmt = json.dumps(req.matrice_diff, ensure_ascii=False)[:2000]
    matching_fmt = json.dumps(req.matching_result, ensure_ascii=False)[:2000]
    champs_fmt  = json.dumps(req.champs_p1, ensure_ascii=False)[:1000]

    user_prompt = (
        f"CHAMPS DOSSIER (Phase 1) :\n{champs_fmt}\n\n"
        f"RÉSULTAT MATCHING :\n{matching_fmt}\n\n"
        f"MATRICE DIFFÉRENCIATION :\n{matrice_fmt}\n\n"
        f"EXTRAIT TDR :\n{req.document_text[:8000]}\n\n"
        f"Génère la méthodologie complète en 5 sections JSON."
    )

    try:
        raw = call_claude_json(system_prompt, user_prompt, max_tokens=8192)
    except ValueError as e:
        logger.error("Génération méthodologie échouée: %s", e)
        raise

    return {
        "SECTION1_COMPREHENSION": raw.get("section1", ""),
        "SECTION2_METHODOLOGIE":  raw.get("section2", ""),
        "SECTION3_PLAN_TRAVAIL":  raw.get("section3", ""),
        "SECTION4_EQUIPE":        raw.get("section4", ""),
        "SECTION5_REFERENCES":    raw.get("section5", ""),
    }