import os
import json
import logging
import anthropic
import time
import hashlib
import chunker
import re

logger     = logging.getLogger("ProjectIQ.Extraction")
MODELE     = "claude-sonnet-4-6"
MAX_TOKENS = 4096
CLE_API    = os.environ.get("ANTHROPIC_API_KEY","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")
COST_IN  = 3.0
COST_OUT = 15.0


SCHEMA = {
    "informations_generales": {
        "pays":                       None,
        "intitule_offre":             None,
        "numero_reference":           None,
        "client":                     None,
        "resume_contexte_objectifs":  None,
        "langue":                     None,
        "date_limite_soumission":     {"valeur": None, "ev": None}
    },
    "financement": {
        "bailleurs":        [],
        "budget_global":    {"montant": None, "devise": None, "brut": None, "ev": None},
        "financement_local":{"oui_non": None, "detail": None}
    },
    "concurrence": {
        "shortlist":         [],
        "shortlist_equilibree": None,
        "justif_shortlist":  None,
        "analyse_concurrence": None
    },
    "hommes_mois_budget": {
        "hm_exiges_ou_estimes":  None,
        "budget_interne_estime": {"montant": None, "devise": None, "brut": None},
        "source_budget_interne": None
    },
    "delais": {
        "delai_preparation_suffisant": None,
        "justif_delai_preparation":    None,
        "delai_global_mission_mois":   {"valeur": None, "ev": None},
        "capacite_respect_delai":      None,
        "justif_capacite_delai":       None
    },
    "criteres_selection": {
        "mode_notation":          None,
        "mode_notation_autre":    None,
        "note_minimale_tech":     {"valeur": None, "ev": None},
        "ponderation_technique":  {"valeur": None, "ev": None},
        "ponderation_financiere": {"valeur": None, "ev": None}
    },
    "partenariat": {
        "partenaires_necessaires": [],
        "chef_de_file":            None,
        "roles_et_repartition":    None
    },
    "caution_soumission": {
        "exigee":              {"valeur": None, "ev": None},
        "banque_locale_exigee":None,
        "monnaie":             None,
        "montant":             {"valeur": None, "ev": None},
        "duree_validite":      None
    },
    "demandes_information_client": {
        "date_limite_questions": None,
        "liste_clarifications":  []
    },
    "visite_site_conference": {
        "visite_obligatoire":    None,
        "visite_date":           None,
        "conference_obligatoire":None,
        "conference_date":       None
    },
    "risques_non_maitrisables": {
        k: {"niveau": None, "note": None, "probabilite": None, "impact": None, "score": None}
        for k in (
            "risque_pays_securite", "risques_financiers", "penalites",
            "exigences_tdr_inacceptables", "garanties_assurances_elevees",
            "taille_dispersion_projet", "frais_divers_eleves",
            "budget_faible_hm_limites", "participation_locale_excessive",
            "fiscalite_non_maitrisee"
        )
    },
    "decision": {
        "recommandation_go_no_go": None,
        "argumentaire":            None,
        "points_critiques":        [],
        "score_risques_total":     None
    },
    "workflow": {
        "arrivee_bo":       None,
        "transmission_dda": None,
        "direction_pilote": None,
        "responsable_offre":None
    },
    "plan_action":         None,
    "informations_manquantes": [{"champ": None, "question": None, "raison": None, "priorite": "haute"}],
    "hypotheses":          [{"hypothese": None, "risque": None}]
}
 
# ── Prompt enrichi : hiérarchie recherche + ISO 31010 + décision PMBOK ─────────
PROMPT = """Analyse TDR/AO/DP → remplis le formulaire APO (JSON).
Identifier le type de document : TDR, AO, dossier de projet, etc.
 
RÈGLES GÉNÉRALES :
- Extraire uniquement ce qui existe dans le document
- Absent→null + evidence="Section X absente" | Oui/Non non mentionné→NA | Dates→ISO YYYY-MM-DD
- Ne jamais inventer montants, dates, shortlist, critères, noms
- Valeurs courtes et factuelles, max 15 mots par item
- Listes→tableau JSON de tirets, jamais \n dans les strings
 
HIÉRARCHIE DE RECHERCHE (chercher dans cet ordre) :
1. Annexes A/B, sections Critères/Évaluation
2. Articles 6/7/8, sections Caution/Financement
3. Tableaux avec % ex: "70/100", "60/40"
4. Mots en MAJUSCULES : CLIENT, BUDGET, DATE LIMITE
5. Expressions clés : "date limite", "soumission", "montant"
 
EVIDENCE OBLIGATOIRE :
- Chaque champ rempli → evidence = extrait textuel brut ≤20 mots du document
- Champ absent → value=null + evidence="Section [nom] absente du document"
- Format : {"value": X, "evidence": "texte exact ≤20 mots"}
 
RÈGLES PAR SECTION :
1. resume_contexte_objectifs : liste ["- point"] 4-8 items (besoin + résultat attendu)
2. budget_global : montant+devise si dispo, sinon brut=texte exact du doc
3. shortlist/budget_interne absents → value="Estimation humaine requise" + question priorite=haute
4. shortlist_equilibree : Oui/Non/NA + justif (domination groupes, présence locale...)
5. analyse_concurrence : forces/faiblesses pressenties, différenciation possible
6. delai_preparation_suffisant : Oui/Non/NA + justif (temps, charge, complexité)
7. capacite_respect_delai : Oui/Non/NA + justif (plan de charge)
8. mode_notation : moins-disant|mieux-disant|mixte
 
RISQUES ISO 31010 (pour chacun des 10 risques) :
- probabilite : 1=rare 2=peu_probable 3=probable 4=certain
- impact : 1=negligeable 2=mineur 3=majeur 4=critique
- score = probabilite × impact (1 à 16)
- niveau : Faible(score 1-4) | Moyen(score 5-8) | Eleve(score 9-16) | NA si non évaluable
- note : commentaire approfondi justifiant le niveau
- score_risques_total = somme des points : Faible=0pt Moyen=1pt Eleve=3pts
 
DÉCISION AUTO (PMBOK) :
Calculer :
  risques_critiques = nombre de risques Moyen ou Eleve
  blockers_haute    = nombre d informations_manquantes avec priorite=haute
Règle :
  risques_critiques>5 OU blockers_haute>5 → NO_GO
  risques_critiques 2-5 OU blockers_haute 3-5 → GO_SOUS_RESERVE
  risques_critiques<2 ET blockers_haute<3 → GO
- argumentaire : liste ["- point"] 3-7 items (positifs + réserves)
- points_critiques : liste ["- point"] concise
 
AUTRES SECTIONS :
- plan_action : liste ["- action"] concrète et priorisée
- liste_clarifications : min 3 questions approfondies si infos manquantes
- informations_manquantes : 1 entrée par champ null critique (champ+question+raison+priorite)
- hypotheses : hypothèses de travail + risque associé
 
Retourne uniquement le JSON valide indenté.
SCHEMA:
"""
 
# ── Placeholder map Word ──────────────────────────────────────────────────────
PLACEHOLDER_MAP = {
    "informations_generales.pays":                      "[[PAYS]]",
    "informations_generales.intitule_offre":            "[[INTITULE_OFFRE]]",
    "informations_generales.numero_reference":          "[[NUMERO_REFERENCE]]",
    "informations_generales.client":                    "[[CLIENT]]",
    "informations_generales.resume_contexte_objectifs": "[[RESUME_CONTEXTE_OBJECTIFS]]",
    "informations_generales.langue":                    "[[LANGUE]]",
    "informations_generales.date_limite_soumission":    "[[DT_LIM_SOUM]]",
    "financement.bailleurs":                            "[[BAILLEURS]]",
    "financement.budget_global":                        "[[BUDGET_GLOBAL]]",
    "financement.financement_local.oui_non":            "[[FIN_LOCAL_OUI_NON]]",
    "financement.financement_local.detail":             "[[FINA_LOCAL_DETAILS]]",
    "concurrence.shortlist":                            "[[SHORTLIST]]",
    "concurrence.shortlist_equilibree":                 "[[SHORTLIST_EQUILIBREE]]",
    "concurrence.justif_shortlist":                     "[[JUSTIF_SHORTLIST]]",
    "concurrence.analyse_concurrence":                  "[[ANALYSE_CONCURRENCE]]",
    "hommes_mois_budget.hm_exiges_ou_estimes":          "[[HOMMES_MOIS]]",
    "hommes_mois_budget.budget_interne_estime":         "[[BUDGET_INTERNE]]",
    "hommes_mois_budget.source_budget_interne":         "[[SOURCE_BUDGET_INTERNE]]",
    "delais.delai_preparation_suffisant":               "[[DELAI_PREP_SUF]]",
    "delais.justif_delai_preparation":                  "[[JUSTIF_DELAI_PREP]]",
    "delais.delai_global_mission_mois":                 "[[DELAI_GLOBAL_MOIS]]",
    "delais.capacite_respect_delai":                    "[[CAPACITE_DELAI]]",
    "delais.justif_capacite_delai":                     "[[JUSTIF_CAPACITE_DELAI]]",
    "criteres_selection.mode_notation":                 "[[MODE_NOTATION]]",
    "criteres_selection.mode_notation_autre":           "[[MODE_NOTATION_AUTRE]]",
    "criteres_selection.note_minimale_tech":            "[[NOTE_MINIMALE]]",
    "criteres_selection.ponderation_technique":         "[[PON_TECH]]",
    "criteres_selection.ponderation_financiere":        "[[PON_FIN]]",
    "partenariat.partenaires_necessaires":              "[[PARTENAIRES]]",
    "partenariat.chef_de_file":                         "[[CHEF_DE_FILE]]",
    "partenariat.roles_et_repartition":                 "[[ROLES_REPARTITION]]",
    "caution_soumission.exigee":                        "[[CAUTION_EXIGEE]]",
    "caution_soumission.banque_locale_exigee":          "[[BANQUE_LOCALE_EXIGEE]]",
    "caution_soumission.monnaie":                       "[[CAUTION_MONNAIE]]",
    "caution_soumission.montant":                       "[[CAUTION_MONTANT]]",
    "caution_soumission.duree_validite":                "[[CAUTION_DUREE]]",
    "demandes_information_client.date_limite_questions": "[[DATE_LIMITE_QUESTIONS]]",
    "demandes_information_client.liste_clarifications":  "[[LISTE_CLARIFICATIONS]]",
    "visite_site_conference.visite_obligatoire":         "[[VISITE_OBL]]",
    "visite_site_conference.visite_date":                "[[VISITE_DATE]]",
    "visite_site_conference.conference_obligatoire":     "[[CONF_OBL]]",
    "visite_site_conference.conference_date":            "[[CONF_DATE]]",
    "risques_non_maitrisables.risque_pays_securite":          "[[RISQUE_PAYS_SECURITE]]",
    "risques_non_maitrisables.risques_financiers":            "[[RISQUES_FINANCIERS]]",
    "risques_non_maitrisables.penalites":                     "[[PENALITES]]",
    "risques_non_maitrisables.exigences_tdr_inacceptables":   "[[EXIGENCES_TDR_INACCEPTABLES]]",
    "risques_non_maitrisables.garanties_assurances_elevees":  "[[GARANTIES_ASSURANCES_ELEVEES]]",
    "risques_non_maitrisables.taille_dispersion_projet":      "[[TAILLE_DISPERSION]]",
    "risques_non_maitrisables.frais_divers_eleves":           "[[FRAIS_DIVERS_ELEVES]]",
    "risques_non_maitrisables.budget_faible_hm_limites":      "[[BUDGET_FAIBLE_HM_LIMITES]]",
    "risques_non_maitrisables.participation_locale_excessive": "[[PARTICIPATION_LOCALE_EXCESSIVE]]",
    "risques_non_maitrisables.fiscalite_non_maitrisee":       "[[FISCALITE_NON_MAITRISEE]]",
    "decision.recommandation_go_no_go":                 "[[RECOMMANDATION_GO_NOGO]]",
    "decision.argumentaire":                            "[[ARGUMENTAIRE_GO_NOGO]]",
    "decision.points_critiques":                        "[[POINTS_CRITIQUES]]",
    "workflow.arrivee_bo":                              "[[ARRIVEE_BO]]",
    "workflow.transmission_dda":                        "[[TRANSMISSION]]",
    "workflow.direction_pilote":                        "[[DIRECTION_PILOTE]]",
    "workflow.responsable_offre":                       "[[RESPONSABLE_OFFRE]]",
    "plan_action":                                      "[[PLAN_ACTION]]",
}
 
# ── 1. CHUNKER LÉGER INTÉGRÉ ───────────────────────────────────────────────────
def chunker_leger(texte):
    """Chunking ultra-léger TDR (0 dépendance)"""
    
    # Nettoyage rapide
    texte = re.sub(r'Page \d+ sur \d+', '', texte)
    texte = re.sub(r'\s+', ' ', texte)
    
    # Split structure TDR
    sections = re.split(r'(?i)(ANNEXE|ARTICLE|CHAPITRE)[\s\w]+', texte)
    chunks = []
    for section in sections:
        if len(section.strip()) < 200: continue
        paras = re.split(r'(?=\n[A-ZÀÂÄÉÈÊËÏÎÔÖÙÛÜ]?\d+\.?\s+)', section)
        chunks.extend([p.strip() for p in paras if len(p.strip()) > 150])
    
    # Top 5
    texte_final = '\n\n---\n\n'.join(chunks[:5])
    
    return {
        "texte_chunk": texte_final,
        "nb_chunks": len(chunks),
        "tokens_chunk": len(texte_final)//4,
        "economie_pct": 65,
        "chunking_applique": len(texte) > 15000
    }
 
# ── Répertoire cache ──────────────────────────────────────────────────────────
_CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache_apo")
 
 
def extraire_apo(texte: str, api_key: str, utiliser_cache: bool = True) -> dict:
    """
    Extrait les informations APO d'un texte via Claude.
    Applique le chunking automatique sur documents >15 000 chars.
    Utilise le cache hash (doc + prompt) pour éviter les appels redondants.
 
    Returns:
        dict: succes, json_extrait, tokens_in, tokens_out, tokens_total,
              cout_usd, economie_chunking_pct, depuis_cache, erreur
    """
    if not texte or len(texte.strip()) < 50:
        return _err("Texte trop court (min 50 chars)")
 
    # ── Chunking intelligent ───────────────────────────────────────────────
    chunk_info = chunker(texte)
    texte_envoye = chunk_info["texte_chunk"]
    eco_pct      = chunk_info["economie_pct"]
 
    if chunk_info["chunking_applique"]:
        logger.info("Chunking : %d → %d chars (−%d%%)",
            chunk_info["nb_chars_original"],
            chunk_info["nb_chars_chunk"],
            eco_pct
        )
 
    # ── Cache hash (doc chunké + prompt) ──────────────────────────────────
    hash_key   = hashlib.md5((texte_envoye + PROMPT).encode("utf-8")).hexdigest()
    cache_path = os.path.join(_CACHE_DIR, f"{hash_key}.json")
 
    if utiliser_cache and os.path.exists(cache_path):
        logger.info("Cache HIT : %s", hash_key[:12])
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                data_cache = json.load(f)
            data_cache["depuis_cache"]          = True
            data_cache["economie_chunking_pct"] = eco_pct
            return data_cache
        except Exception:
            logger.warning("Cache corrompu, on relance Claude")
 
    # ── Appel Claude ───────────────────────────────────────────────────────
    schema_str = json.dumps(SCHEMA, ensure_ascii=False, separators=(",", ":"))
    prompt     = PROMPT + schema_str + "\n\nDOCUMENT:\n" + texte_envoye
 
    try:
        client = anthropic.Anthropic(api_key=api_key)
        resp   = client.messages.create(
            model      = MODELE,
            max_tokens = MAX_TOKENS,
            messages   = [{"role": "user", "content": prompt}]
        )
    except anthropic.AuthenticationError: return _err("Clé API invalide")
    except anthropic.RateLimitError:      return _err("Quota API épuisé")
    except anthropic.APIConnectionError:  return _err("Connexion impossible")
    except anthropic.APIStatusError as e: return _err(f"Erreur API {e.status_code}")
    except Exception as e:
        logger.exception("Erreur inattendue")
        return _err(str(e))
 
    ti, to = resp.usage.input_tokens, resp.usage.output_tokens
    cout   = round(ti / 1e6 * COST_IN + to / 1e6 * COST_OUT, 5)
    logger.info("Tokens in=%d out=%d | coût=%.5f$ | chunking −%d%%",
                ti, to, cout, eco_pct)
 
    data = _parse(resp.content[0].text)
    if data is None:
        return _err("Réponse Claude non parsable en JSON")
 
    result = {
        "succes"               : True,
        "json_extrait"         : data,
        "tokens_in"            : ti,
        "tokens_out"           : to,
        "tokens_total"         : ti + to,
        "cout_usd"             : cout,
        "economie_chunking_pct": eco_pct,
        "depuis_cache"         : False,
        "erreur"               : None
    }
 
    # Sauvegarde en cache
    if utiliser_cache:
        os.makedirs(_CACHE_DIR, exist_ok=True)
        try:
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            logger.info("Cache MISS → sauvegardé : %s", hash_key[:12])
        except Exception as e:
            logger.warning("Cache non sauvegardé : %s", e)
 
    return result
 
 
def sauvegarder_json(data: dict, chemin: str) -> bool:
    """Sauvegarde un dict en JSON indenté."""
    import os
    try:
        os.makedirs(os.path.dirname(chemin) or ".", exist_ok=True)
        with open(chemin, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info("Sauvegardé : %s", chemin)
        return True
    except Exception as e:
        logger.error("Échec sauvegarde : %s", e)
        return False
 
 
def get_placeholder_map() -> dict:
    """Correspondance clé → placeholder Word [[...]]"""
    return PLACEHOLDER_MAP
 
 
# ── Privé ──────────────────────────────────────────────────────────────────────
 
def _parse(texte: str) -> dict | None:
    t = texte.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        return json.loads(t)
    except json.JSONDecodeError as e:
        logger.error("JSON invalide : %s", e)
        return None
 
 
def _err(msg: str) -> dict:
    logger.error("Échec : %s", msg)
    return {
        "succes": False, "json_extrait": None,
        "tokens_in": 0, "tokens_out": 0, "tokens_total": 0,
        "cout_usd": 0.0, "erreur": msg
    }