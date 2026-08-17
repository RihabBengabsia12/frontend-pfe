"""
Génération de la matrice de différenciation notre cabinet vs AO.
Retourne un tableau JSON [{critere, position, argument}] éditable par l'analyste.
"""

import logging
import json
from services.claude_client import call_claude_json, load_prompt

logger = logging.getLogger(__name__)
POSITIONS_VALIDES = {"✓ Couvert", "≈ Partiel", "✗ Non couvert", "? Inconnu"}

def generate_diff_matrix(matching_result: dict, dossier_id: str, custom_prompts: dict = None) -> list[dict]:
    """
    Génère la matrice de différenciation.
    `matching_result` contient refs_exigees, refs_disponibles, experts_requis, etc.
    Retourne une liste de lignes [{critere, position, argument, editable: true}].
    """
    if custom_prompts is None: custom_prompts = {}
    system_prompt = custom_prompts.get("prompt_diff_matrix.txt") or load_prompt("prompt_diff_matrix.txt")

    user_prompt = (
        f"RÉSULTAT DE MATCHING (dossier {dossier_id}) :\n"
        f"{json.dumps(matching_result, ensure_ascii=False, indent=2)[:6000]}"
    )

    try:
        raw, metrics = call_claude_json(system_prompt, user_prompt)
    except ValueError as e:
        logger.error("Génération matrice différenciation échouée: %s", e)
        raise

    rows = raw.get("matrice", raw) if isinstance(raw, dict) else raw
    if not isinstance(rows, list):
        logger.warning("Réponse matrice inattendue, type=%s", type(rows))
        return [], metrics

    # Normalisation + validation des lignes
    result = []
    for row in rows:
        position = row.get("position", "? Inconnu")
        if position not in POSITIONS_VALIDES:
            position = "? Inconnu"
        result.append({
            "critere":  row.get("critere", ""),
            "positionCabinet": position,
            "argumentGap": row.get("argument", ""),
            "editable": True,
        })

    return result, metrics