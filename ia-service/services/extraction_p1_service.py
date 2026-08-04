"""
Extraction Phase 1 — 12 champs bloquants depuis le TDR/AP.
Un seul appel Claude avec prompt_p1.txt.
"""

import logging
from models.extraction_request  import ExtractionRequest, ReextractFieldRequest
from models.extraction_response import ExtractionResponse, ChampExtraitIA
from services.claude_client     import call_claude_json, load_prompt
from validators.field_validators import validate_all_p1, calc_tjm_implicite

logger = logging.getLogger(__name__)

CHAMPS_P1 = [
    "PAYS", "INTITULE_OFFRE", "CLIENT", "BAILLEURS",
    "BUDGET_GLOBAL", "HOMMES_MOIS", "DT_LIM_SOUM",
    "LANGUE", "VISITE_OBL", "VISITE_DATE", "CONF_OBL", "CONF_DATE",
]


def extract_phase1(req: ExtractionRequest) -> ExtractionResponse:
    """
    Extraction des 12 champs Phase 1.
    Format réponse Claude attendu :
    {
      "PAYS": {"valeur": "Maroc", "confiance": 0.95, "source": "..."},
      ...
      "alertes": ["..."]
    }
    """
    custom = req.custom_prompts.get("prompt_p1.txt") if req.custom_prompts else None
    system_prompt = custom if custom else load_prompt("prompt_p1.txt")
    user_prompt   = "Analyse le document fourni et extrais les 12 champs Phase 1 en respectant exactement le format JSON spécifié dans tes instructions."

    try:
        raw, metrics = call_claude_json(system_prompt, user_prompt, document_text=req.document_text[:40000])
    except ValueError as e:
        logger.error("Extraction P1 échouée pour dossier %s: %s", req.dossier_id, e)
        raise

    champs: dict[str, ChampExtraitIA] = {}
    for nom in CHAMPS_P1:
        data = raw.get(nom, {})
        champs[nom] = ChampExtraitIA(
            valeur    = data.get("valeur"),
            confiance = float(data.get("confiance", 0.0)),
            source    = data.get("source", ""),
        )

    # Calcul TJM implicite (champ calculé, pas extrait par Claude)
    hm_val = champs["HOMMES_MOIS"].valeur
    hm_float = None
    if hm_val:
        try:
            hm_float = float(str(hm_val).replace(",", ".").split()[0])
        except (ValueError, IndexError):
            pass

    tjm = calc_tjm_implicite(champs["BUDGET_GLOBAL"].valeur, hm_float)
    if tjm is not None:
        champs["TJM_IMPLICITE"] = ChampExtraitIA(
            valeur    = f"{tjm:.2f}",
            confiance = 1.0,
            source    = "calculé: BUDGET ÷ HM ÷ 20",
        )

    # Validation post-extraction
    valeurs = {k: v.valeur for k, v in champs.items()}
    alertes = validate_all_p1(valeurs)
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


def reextract_field(req: ReextractFieldRequest) -> ChampExtraitIA:
    """
    Ré-extraction ciblée d'un seul champ (max 2 tentatives côté frontend).
    Utilise un prompt minimaliste focalisé sur le champ demandé.
    """
    system_prompt = (
        "Tu es un analyste senior spécialisé en appels d'offres d'ingénierie conseil internationale. "
        "Tu dois ré-extraire un champ précis depuis un document d'appel d'offres (TDR ou Avis de Publicité). "
        "RÈGLES ABSOLUES : "
        "1. Réponds UNIQUEMENT en JSON pur, sans aucune balise Markdown (pas de ```json). "
        "2. Retourne exactement ce format : {\"valeur\": \"valeur extraite ou null\", \"confiance\": 0.0-1.0, \"source\": \"citation verbatim du document\"}. "
        "3. 'source' doit être une citation verbatim exacte du document (10-30 mots). "
        "4. Si le champ est absent, retourne null pour 'valeur' et 0.0 pour 'confiance'. Ne jamais inventer. "
        f"5. Le champ à extraire est : '{req.field_name}'. "
        "6. CONFIANCE : 0.9-1.0 = explicite dans le texte | 0.6-0.89 = implicite | 0.3-0.59 = déduit | 0.0 = absent."
    )
    user_prompt = f"Extrais le champ '{req.field_name}' du document fourni et retourne le résultat en JSON."

    raw, metrics = call_claude_json(system_prompt, user_prompt, max_tokens=512, document_text=req.document_text[:20000])
    champ = ChampExtraitIA(
        valeur    = raw.get("valeur"),
        confiance = float(raw.get("confiance", 0.0)),
        source    = raw.get("source", ""),
    )
    return champ, metrics