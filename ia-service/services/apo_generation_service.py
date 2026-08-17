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
    ctx    = _build_context(req)
    cp     = req.custom_prompts or {}

    total_stats = {
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_creation_tokens": 0,
        "cache_read_tokens": 0,
        "estimated_cost": 0.0,
        "processing_time_ms": 0,
        "token_usage": 0
    }
    
    def merge_stats(s):
        if not s: return
        total_stats["input_tokens"] += s.get("input_tokens", 0)
        total_stats["output_tokens"] += s.get("output_tokens", 0)
        total_stats["cache_creation_tokens"] += s.get("cache_creation_tokens", 0)
        total_stats["cache_read_tokens"] += s.get("cache_read_tokens", 0)
        total_stats["estimated_cost"] += s.get("estimated_cost", 0.0)
        total_stats["processing_time_ms"] += s.get("processing_time_ms", 0)
        total_stats["token_usage"] += s.get("token_usage", 0)

    t_resume, s_resume = _gen_resume(ctx, cp)
    merge_stats(s_resume)
    
    t_points, s_points = _gen_points_critiques(ctx, req.risques, cp)
    merge_stats(s_points)
    
    t_arg, s_arg = _gen_argumentaire(ctx, req.pwin_score or 0, req.decision_auto, cp)
    merge_stats(s_arg)
    
    t_clar, s_clar = _gen_clarifications(ctx, req.risques, cp)
    merge_stats(s_clar)

    return {
        "RESUME_CONTEXTE_OBJECTIFS": t_resume,
        "POINTS_CRITIQUES":          t_points,
        "RECOMMANDATION_GO_NOGO":    _gen_recommandation(req.pwin_score or 0, req.decision_auto),
        "ARGUMENTAIRE_GO_NOGO":      t_arg,
        "LISTE_CLARIFICATIONS":      t_clar,
        "stats": total_stats
    }


# ─────────────────────────────────────────────
# Sous-fonctions privées
# ─────────────────────────────────────────────

def _build_context(req: ApoGenerationRequest) -> str:
    return (
        f"Intitulé : {req.intitule_offre or 'N/A'}\n"
        f"Client   : {req.client or 'N/A'} — Pays : {req.pays or 'N/A'}\n"
        f"Bailleurs: {req.bailleurs or 'N/A'}\n"
        f"Budget   : {req.budget_global or 'N/A'} / {req.hommes_mois or 'N/A'} HM\n"
        f"TJM impl.: {req.tjm_implicite or 'N/A'} €/j\n"
        f"Délai    : {req.delai_global_mois or 'N/A'} mois\n"
        f"P-Win    : {(req.pwin_score or 0):.1f}% — {req.decision_auto or 'N/A'}\n"
        f"Secteur  : {req.secteur_ao or 'N/A'}\n"
        f"Bailleur : {req.bailleurs or 'N/A'}\n"
    )


def _gen_resume(ctx: str, custom_prompts: dict) -> tuple:
    system_prompt = custom_prompts.get("prompt_apo_resume.txt") or load_prompt("prompt_apo_resume.txt")
    user_prompt   = f"DONNÉES DU DOSSIER :\n{ctx}\n\nGénère le résumé contexte-objectifs (5 lignes max, factuel)."
    text, stats = call_claude(system_prompt, user_prompt, max_tokens=512)
    return text.strip(), stats


def _gen_points_critiques(ctx: str, risques: list[dict], custom_prompts: dict) -> tuple:
    system_prompt = custom_prompts.get("prompt_points_critiques.txt") or load_prompt("prompt_points_critiques.txt")

    risques_eleves = []
    for risque in risques:
        if risque.get("niveau") in ("Élevé", "Rédhibitoire"):
            risques_eleves.append(f"- {risque.get('nom')}: {risque.get('justification')}")

    risques_str = "\n".join(risques_eleves) if risques_eleves else "Aucun risque majeur."

    user_prompt = (
        f"DONNÉES DU DOSSIER :\n{ctx}\n\n"
        f"RISQUES ÉLEVÉS DÉTECTÉS :\n{risques_str}\n\n"
        f"Génère la liste des points critiques (bullet points concis)."
    )
    text, stats = call_claude(system_prompt, user_prompt, max_tokens=600)
    return text.strip(), stats


def _gen_recommandation(score: float, decision_auto: str) -> str:
    if "GO" in (decision_auto or ""):
        return "GO / GO SOUS CONDITIONS"
    if "NO_GO" in (decision_auto or ""):
        return "NO GO"
    return "À DÉTERMINER"


def _gen_argumentaire(ctx: str, score: float, decision_auto: str, custom_prompts: dict) -> tuple:
    system_prompt = custom_prompts.get("prompt_apo_argumentaire.txt") or load_prompt("prompt_apo_argumentaire.txt")
    if not system_prompt:
        system_prompt = "Tu es un directeur commercial justifiant une décision d'y aller ou non sur un appel d'offres."
    user_prompt = (
        f"DONNÉES DU DOSSIER :\n{ctx}\n\n"
        f"Score P-Win : {score:.1f}%\n"
        f"Décision    : {_gen_recommandation(score, decision_auto)}\n\n"
        f"Génère l'argumentaire de décision Go/No-Go (100 à 200 mots, structuré, professionnel)."
    )
    text, stats = call_claude(system_prompt, user_prompt, max_tokens=900)
    return text.strip(), stats


def _gen_clarifications(ctx: str, risques: list[dict], custom_prompts: dict) -> tuple:
    system_prompt = custom_prompts.get("prompt_apo_clarifications.txt") or load_prompt("prompt_apo_clarifications.txt") if custom_prompts else None
    if not system_prompt:
        system_prompt = "Tu es un expert en appel d'offres. Génère une liste de 3 questions ou clarifications cruciales à demander au client (GIZ, etc.) avant de soumettre l'offre, basées sur les risques identifiés. Format: tirets."
    
    risques_eleves = [f"{r.get('nom')}: {r.get('justification')}" for r in risques if r.get("niveau") in ("Élevé", "Rédhibitoire")]
    
    user_prompt = (
        f"DONNÉES DU DOSSIER :\n{ctx}\n\n"
        f"RISQUES ÉLEVÉS :\n{chr(10).join(risques_eleves) or 'Aucun'}\n\n"
        f"Rédige 3 clarifications très concrètes à poser au client."
    )
    text, stats = call_claude(system_prompt, user_prompt, max_tokens=400)
    return text.strip(), stats