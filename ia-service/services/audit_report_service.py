"""
Génération du rapport d'audit narratif (Phase 6).
Claude produit un résumé structuré du cycle de vie du dossier.
"""

import logging
import json
from models.generation_request import AuditReportRequest
from services.claude_client    import call_claude, load_prompt

logger = logging.getLogger(__name__)


def generate_audit_report(req: AuditReportRequest) -> str:
    """
    Retourne un rapport d'audit narratif structuré (texte, ~400 mots).
    Basé sur toutes les AuditEntry du dossier.
    """
    system_prompt = (
        "Tu es un expert en gestion d'appels d'offres. "
        "Génère un rapport d'audit professionnel du cycle de vie de ce dossier. "
        "Structure : (1) Résumé du dossier, (2) Chronologie des décisions clés, "
        "(3) Score P-Win et justification, (4) Points d'amélioration pour analyses similaires. "
        "Ton : factuel, concis, professionnel. 350 à 450 mots."
    )

    timeline = _format_timeline(req.audit_entries)

    user_prompt = (
        f"DOSSIER ID : {req.dossier_id}\n"
        f"DÉCISION FINALE : {req.decision_finale or 'Non renseignée'}\n"
        f"P-WIN FINAL : {req.pwin_score or 'N/A'}%\n\n"
        f"TIMELINE COMPLÈTE :\n{timeline}"
    )

    return call_claude(system_prompt, user_prompt, max_tokens=1200)


def _format_timeline(entries: list[dict]) -> str:
    """Formate la liste d'AuditEntry en texte lisible pour le prompt."""
    if not entries:
        return "Aucune entrée d'audit disponible."

    lines = []
    for e in entries:
        ts     = e.get("timestamp", "")[:16]  # JJ/MM/AAAA HH:MM
        action = e.get("action", "")
        acteur = e.get("acteur", "Système")
        detail = e.get("detail", {})
        detail_str = json.dumps(detail, ensure_ascii=False)[:200] if detail else ""
        lines.append(f"[{ts}] {acteur} — {action}{' | ' + detail_str if detail_str else ''}")

    return "\n".join(lines)