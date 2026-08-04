"""
Génération du rapport No-Go narratif (200-300 mots).
Appelé quand P-Win < seuil ou quand un risque Rédhibitoire est confirmé.
"""

import logging
import json
from models.extraction_request import NoGoReportRequest
from services.claude_client    import call_claude, load_prompt

logger = logging.getLogger(__name__)


def generate_nogo_report(req: NoGoReportRequest) -> str:
    """
    Retourne un rapport No-Go structuré en texte (200-300 mots).
    Claude argumente pourquoi l'opportunité ne justifie pas l'investissement.
    """
    system_prompt = req.custom_prompt if req.custom_prompt else load_prompt("prompt_nogo_report.txt")

    champs_fmt = json.dumps(req.champs_principaux, ensure_ascii=False, indent=2)
    redh_fmt   = "\n".join(f"- {r}" for r in req.risques_redhibitoires) or "Aucun"

    user_prompt = f"""DONNÉES DU DOSSIER :
Score P-Win global : {req.pwin_score:.1f}%
  A. Faisabilité    : {req.score_a_faisabilite:.1f}%
  B. Rentabilité    : {req.score_b_rentabilite:.1f}%
  C. Risques        : {req.score_c_risques:.1f}%
  D. Concurrence    : {req.score_d_concurrence:.1f}%
  E. Conformité     : {req.score_e_conformite:.1f}%

Risques Rédhibitoires détectés :
{redh_fmt}

Champs clés extraits :
{champs_fmt}

Génère un rapport No-Go professionnel de 200 à 300 mots destiné au management."""

    text, _ = call_claude(system_prompt, user_prompt, max_tokens=800)
    return text