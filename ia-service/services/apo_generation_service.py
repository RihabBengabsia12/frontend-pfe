"""
Génération des champs textuels APO par Claude (Phase 4).
RESUME_CONTEXTE, POINTS_CRITIQUES, RECOMMANDATION_GO_NOGO, ARGUMENTAIRE_GO_NOGO.
"""

import logging
import json
from models.generation_request import ApoGenerationRequest
from services.claude_client    import call_claude, call_claude_json, load_prompt

logger = logging.getLogger(__name__)


def generate_apo_texts(req: ApoGenerationRequest) -> dict:
    """
    Génère en parallèle (séquentiel ici) tous les champs textuels APO.
    Retourne un dict {NOM_CHAMP: texte_genere}.
    """
    champs = req.champs_p1_p2_p3
    pwin   = req.pwin_score
    ctx    = _build_context(champs, pwin)
    cp     = req.custom_prompts or {}

    return {
        "RESUME_CONTEXTE_OBJECTIFS": _gen_resume(ctx, cp),
        "POINTS_CRITIQUES":          _gen_points_critiques(ctx, champs, cp),
        "RECOMMANDATION_GO_NOGO":    _gen_recommandation(pwin),
        "ARGUMENTAIRE_GO_NOGO":      _gen_argumentaire(ctx, pwin, cp),
        "LISTE_CLARIFICATIONS":      champs.get("LISTE_CLARIFICATIONS", ""),
    }


# ─────────────────────────────────────────────
# Sous-fonctions privées
# ─────────────────────────────────────────────

def _build_context(champs: dict, pwin: dict) -> str:
    return (
        f"Intitulé : {champs.get('INTITULE_OFFRE', 'N/A')}\n"
        f"Client   : {champs.get('CLIENT', 'N/A')} — Pays : {champs.get('PAYS', 'N/A')}\n"
        f"Bailleurs: {champs.get('BAILLEURS', 'N/A')}\n"
        f"Budget   : {champs.get('BUDGET_GLOBAL', 'N/A')} / {champs.get('HOMMES_MOIS', 'N/A')} HM\n"
        f"TJM impl.: {champs.get('TJM_IMPLICITE', 'N/A')} €/j\n"
        f"Délai    : {champs.get('DELAI_GLOBAL_MOIS', 'N/A')} mois\n"
        f"P-Win    : {pwin.get('score_global', 0):.1f}% — {pwin.get('decision_auto', 'N/A')}\n"
        f"Secteur  : {champs.get('SECTEUR_AO', 'N/A')}\n"
        f"Bailleur : {champs.get('BAILLEURS', 'N/A')}\n"
        f"Partenaires: {champs.get('PARTENAIRES', 'N/A')}"
    )


def _gen_resume(ctx: str, custom_prompts: dict) -> str:
    system_prompt = custom_prompts.get("prompt_apo_resume.txt") or load_prompt("prompt_apo_resume.txt")
    user_prompt   = f"DONNÉES DU DOSSIER :\n{ctx}\n\nGénère le résumé contexte-objectifs (5 lignes max, factuel)."
    text, _ = call_claude(system_prompt, user_prompt, max_tokens=512)
    return text.strip()


def _gen_points_critiques(ctx: str, champs: dict, custom_prompts: dict) -> str:
    system_prompt = custom_prompts.get("prompt_points_critiques.txt") or load_prompt("prompt_points_critiques.txt")

    risques_eleves = []
    for cle, valeur in champs.items():
        if str(valeur) in ("Élevé", "Rédhibitoire"):
            risques_eleves.append(f"{cle}: {valeur}")

    visite_alerte = ""
    if champs.get("VISITE_OBL") == "Oui" and champs.get("VISITE_DATE"):
        visite_alerte = f"VISITE OBLIGATOIRE le {champs['VISITE_DATE']} — À vérifier en urgence"

    user_prompt = (
        f"DONNÉES DU DOSSIER :\n{ctx}\n\n"
        f"RISQUES ÉLEVÉS/RÉDHIBITOIRES :\n{chr(10).join(risques_eleves) or 'Aucun'}\n\n"
        f"ALERTES CALENDRIER : {visite_alerte or 'RAS'}\n\n"
        f"Génère 5 à 7 points critiques prioritaires pour le décideur (bullets courts)."
    )
    text, _ = call_claude(system_prompt, user_prompt, max_tokens=700)
    return text.strip()


def _gen_recommandation(pwin: dict) -> str:
    score = pwin.get("score_global", 0)
    if score >= 70:
        return "GO"
    elif score >= 40:
        return "GO conditionnel"
    else:
        return "NO-GO"


def _gen_argumentaire(ctx: str, pwin: dict, custom_prompts: dict) -> str:
    system_prompt = custom_prompts.get("prompt_apo_argumentaire.txt") or load_prompt("prompt_apo_argumentaire.txt")
    user_prompt   = (
        f"DONNÉES DU DOSSIER :\n{ctx}\n\n"
        f"Score P-Win : {pwin.get('score_global', 0):.1f}%\n"
        f"Décision    : {_gen_recommandation(pwin)}\n\n"
        f"Génère l'argumentaire de décision Go/No-Go (100 à 200 mots, structuré, professionnel)."
    )
    text, _ = call_claude(system_prompt, user_prompt, max_tokens=900)
    return text.strip()