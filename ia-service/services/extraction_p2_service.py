"""
Extraction Phase 2 — 20+ champs : notation, caution, délais, financement local, clarifications.
Un seul appel Claude avec prompt_p2_fields.txt.
"""

import logging
from models.extraction_request  import ExtractionRequest
from models.extraction_response import ExtractionResponse, ChampExtraitIA
from services.claude_client     import call_claude_json, load_prompt
from validators.field_validators import validate_all_p2

logger = logging.getLogger(__name__)

CHAMPS_P2 = [
    "DATE_LIMITE_QUESTIONS",
    "DELAI_GLOBAL_MOIS",
    "DELAI_PREP_SUF",
    "JUSTIF_DELAI_PREP",
    "FIN_LOCAL_OUI_NON",
    "FINA_LOCAL_DETAILS",
    "MODE_NOTATION",
    "NOTE_MINIMALE",
    "PON_TECH",
    "PON_FIN",
    "CAUTION_MONTANT",
    "CAUTION_MONNAIE",
    "CAUTION_DUREE",
    "BANQUE_LOCALE_EXIGEE",
    "SECTEUR_AO",
    "TYPE_CONTRAT",
    "CONDITIONS_RESILIATION",
    "QUALIFS_EXIGEES",
    "REFS_EXIGEES",
    "LISTE_CLARIFICATIONS",
]


def extract_phase2(req: ExtractionRequest) -> ExtractionResponse:
    """
    Extraction des champs Phase 2.
    Même format de réponse que Phase 1 : {NOM_CHAMP: {valeur, confiance, source}}.
    """
    custom = req.custom_prompts.get("prompt_p2_fields.txt") if req.custom_prompts else None
    system_prompt = custom if custom else load_prompt("prompt_p2_fields.txt")
    user_prompt   = "Analyse le document fourni et extrais les 20 champs Phase 2 en respectant exactement le format JSON spécifié dans tes instructions."

    try:
        raw, metrics = call_claude_json(system_prompt, user_prompt, max_tokens=6144, document_text=req.document_text[:40000])
    except ValueError as e:
        logger.error("Extraction P2 échouée pour dossier %s: %s", req.dossier_id, e)
        raise

    champs: dict[str, ChampExtraitIA] = {}
    for nom in CHAMPS_P2:
        data = raw.get(nom, {})
        # Certains champs retournent une liste (REFS_EXIGEES, LISTE_CLARIFICATIONS)
        valeur = data.get("valeur")
        if isinstance(valeur, list):
            valeur = "; ".join(str(v) for v in valeur)
        champs[nom] = ChampExtraitIA(
            valeur    = valeur,
            confiance = float(data.get("confiance", 0.0)),
            source    = data.get("source", ""),
        )

    valeurs = {k: v.valeur for k, v in champs.items()}
    alertes = validate_all_p2(valeurs)
    alertes += raw.get("alertes", [])

    return ExtractionResponse(
        dossier_id=req.dossier_id,
        champs=champs,
        alertes=alertes,
        token_usage=metrics["token_usage"],
        processing_time_ms=metrics["processing_time_ms"],
        estimated_cost=metrics["estimated_cost"],
        cache_creation_tokens=metrics.get("cache_creation_tokens", 0),
        cache_read_tokens=metrics.get("cache_read_tokens", 0)
    )