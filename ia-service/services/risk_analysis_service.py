"""
Analyse des 10 risques rédhibitoires.
Claude évalue chaque risque sur 4 niveaux + justification courte.
"""

import logging
import os
from models.extraction_request  import RiskAnalysisRequest
from models.extraction_response import RiskAnalysisResponse, RiskResult
from services.claude_client     import call_claude_json, load_prompt
from validators.scoring_validators import detect_redhibitoires, validate_risk_levels

logger = logging.getLogger(__name__)
DOCUMENT_MAX_CHARS = int(os.getenv("DOCUMENT_MAX_CHARS", "100000"))

RISQUES_ATTENDUS = [
    "risque_pays_securite",
    "risques_financiers",
    "penalites",
    "exigences_tdr_inacceptables",
    "garanties_assurances_elevees",
    "taille_dispersion",
    "frais_divers_eleves",
    "budget_faible_hm_limites",
    "participation_locale_excessive",
    "fiscalite_non_maitrisee",
]

NIVEAUX_VALIDES = {"Faible", "Modéré", "Élevé", "Rédhibitoire"}


def analyze_risks(req: RiskAnalysisRequest) -> RiskAnalysisResponse:
    """
    Analyse les 10 risques. Claude propose un niveau + justification.
    L'humain valide/corrige dans l'interface Angular.
    """
    custom = req.custom_prompts.get("prompt_risk_analysis.txt") if req.custom_prompts else None
    system_prompt = custom if custom else load_prompt("prompt_risk_analysis.txt")

    context_tjm = ""
    if req.tjm_implicite is not None:
        context_tjm = f"\nTJM implicite calculé: {req.tjm_implicite:.0f} €/j"

    user_prompt = f"Extrais les risques à partir du document fourni en utilisant tes instructions.{context_tjm}"

    try:
        raw, metrics = call_claude_json(system_prompt, user_prompt, document_text=req.document_text[:DOCUMENT_MAX_CHARS])
    except ValueError as e:
        logger.error("Analyse risques échouée pour dossier %s: %s", req.dossier_id, e)
        raise

    risques: dict[str, RiskResult] = {}
    for cle in RISQUES_ATTENDUS:
        data = raw.get(cle, {})
        niveau = data.get("niveau", "Faible")
        if niveau not in NIVEAUX_VALIDES:
            logger.warning("Niveau invalide '%s' pour risque '%s' — fallback Modéré", niveau, cle)
            niveau = "Modéré"
        risques[cle] = RiskResult(
            niveau        = niveau,
            justification = data.get("justification", ""),
        )

    # Détection des Rédhibitoires
    risques_dict = {k: v.niveau for k, v in risques.items()}
    redhibitoires = detect_redhibitoires(risques_dict)

    return RiskAnalysisResponse(
        dossier_id            = req.dossier_id,
        risques               = risques,
        alerte_redhibitoire   = len(redhibitoires) > 0,
        risques_redhibitoires = redhibitoires,
        token_usage           = metrics["token_usage"],
        input_tokens          = metrics.get("input_tokens", 0),
        output_tokens         = metrics.get("output_tokens", 0),
        processing_time_ms    = metrics["processing_time_ms"],
        estimated_cost        = metrics["estimated_cost"],
        cache_creation_tokens = metrics.get("cache_creation_tokens", 0),
        cache_read_tokens     = metrics.get("cache_read_tokens", 0)
    )
