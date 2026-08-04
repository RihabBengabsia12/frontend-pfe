"""
TenderBolt — Pipeline Pro : Groq + Claude cible
Groq Llama 3.3 70B (gratuit) → Claude Sonnet cible si necessaire
Prompt professionnel enrichi — adapte a tout type de DP
"""

import os
import sys
import json
import time
import logging
from datetime import datetime

logging.basicConfig(
    level  = logging.INFO,
    format = "%(asctime)s [%(levelname)s] %(name)s — %(message)s"
)
logger = logging.getLogger("TenderBolt.Pipeline")

# ── Configuration ──────────────────────────────────────────────────────────────
CLE_GROQ      = os.environ.get("GROQ_API_KEY",     "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")
CLE_CLAUDE    = os.environ.get("ANTHROPIC_API_KEY", "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")
MODELE_GROQ   = "llama-3.3-70b-versatile"
MODELE_CLAUDE = "claude-sonnet-4-6"
SEUIL_GROQ    = 78   # si taux >= 78% → Groq suffit

CHAMPS_CRITIQUES = [
    "type_document", "bailleur", "pays",
    "titre_document", "duree_mois", "nb_experts"
]

# ── Schema JSON ────────────────────────────────────────────────────────────────
SCHEMA_JSON = {
    "type_document"                  : None,
    "est_template"                   : None,
    "reference"                      : None,
    "titre_document"                 : None,
    "acronyme_mission"               : None,
    "langue"                         : None,
    "date_publication"               : None,
    "date_limite_soumission"         : None,
    "heure_limite_soumission"        : None,
    "date_reunion_preparatoire"      : None,
    "nb_pages"                       : None,
    "nb_lots"                        : None,
    "pays"                           : None,
    "region"                         : None,
    "ville"                          : None,
    "zone_intervention"              : [],
    "pouvoir_adjudicateur"           : {
        "organisation"               : None,
        "acronyme"                   : None,
        "structure"                  : None,
        "acronyme_structure"         : None,
        "adresse"                    : None,
        "telephone"                  : None,
        "email"                      : None,
        "site_web"                   : None,
        "contact_nom"                : None
    },
    "bailleur"                       : None,
    "type_financement"               : None,
    "programme_cadre"                : None,
    "contrat_cadre"                  : None,
    "numero_pret_credit"             : None,
    "beneficiaire"                   : {
        "organisation"               : None,
        "acronyme"                   : None,
        "direction"                  : None,
        "acronyme_direction"         : None,
        "pays"                       : None
    },
    "programmes_connexes"            : [],
    "secteurs"                       : [],
    "mots_cles"                      : [],
    "contexte"                       : [],
    "acronymes"                      : {},
    "objectif_general"               : None,
    "objectifs_specifiques"          : [],
    "duree_mois"                     : None,
    "duree_jours"                    : None,
    "date_debut_prevue"              : None,
    "date_fin_prevue"                : None,
    "delai_execution_jours"          : None,
    "nb_experts"                     : None,
    "total_hommes_jours"             : None,
    "experts"                        : [],
    "lots"                           : [],
    "composantes"                    : [],
    "produits_attendus"              : [],
    "livrables"                      : [],
    "rapports"                       : [],
    "budget_total"                   : None,
    "devise"                         : None,
    "avance_pct"                     : None,
    "cautionnement_pct"              : None,
    "garantie_soumission_pct"        : None,
    "garantie_soumission_montant"    : None,
    "penalites_retard"               : None,
    "modalites_paiement"             : None,
    "delai_paiement_jours"           : None,
    "incoterms"                      : None,
    "prix_ferme"                     : None,
    "validite_offre_jours"           : None,
    "type_evaluation"                : None,
    "note_eliminatoire"              : None,
    "poids_technique_pct"            : None,
    "poids_financier_pct"            : None,
    "criteres_evaluation"            : [],
    "qualification_requise"          : [],
    "variantes_autorisees"           : None,
    "groupements_autorises"          : None,
    "nb_membres_groupement_max"      : None,
    "documents_requis"               : [],
    "logistique"                     : {
        "lieu_principal"             : None,
        "destination_finale"         : None,
        "deplacements"               : None,
        "bureaux"                    : None,
        "equipement"                 : None,
        "sav_requis"                 : None,
        "formation_requise"          : None
    },
    "gestion_projet"                 : {
        "organe_responsable"         : None,
        "supervision"                : None,
        "comite_suivi"               : None,
        "reunions"                   : None,
        "comptes_rendus"             : None
    },
    "risques"                        : [],
    "hypotheses"                     : [],
    "confiance_extraction"           : None,
    "taux_remplissage_pct"           : None,
    "champs_non_trouves"             : [],
    "incoherences"                   : [],
    "notes_extracteur"               : None
}

# ── Prompt professionnel enrichi ───────────────────────────────────────────────
PROMPT_PRO = """Tu es un expert international senior specialise dans l'analyse et l'extraction \
d'informations des dossiers de projets de cooperation internationale et des marches publics. \
Tu possedes une expertise approfondie sur : TDR, AO publics et prives, contrats FIDIC, DCE, \
dossiers complets (TDR+CCAP+IS+annexes).

CONTEXTE GEOGRAPHIQUE ET INSTITUTIONNEL :
Afrique du Nord : Tunisie, Maroc, Algerie, Libye, Egypte
Afrique subsaharienne : Senegal, Cote d'Ivoire, Cameroun, Madagascar, Mali, Niger
Moyen-Orient : Jordanie, Liban, Mauritanie

BAILLEURS RECONNUS :
UE | AFD | BM/BIRD/IDA | BAD/AfDB | PNUD | BEI | FIDA | USAID | KfW | JICA | IsDB | BADEA | GIZ

PROGRAMMES :
P3A/PADR/PACE/ENPARD (UE-Tunisie) | PISEAU | PAPS | MCA/COMPACT | MEDA

ENTITES INSTITUTIONNELLES :
Tunisie : UGP3A, MEP, MARHP, DGEDA, ANPE, ONAS, STEG, SONEDE
Maroc : ONEE, ONE, ORMVAH, ANRT | Algerie : SONELGAZ, ADE, SONATRACH
Regional : ASECNA (20 pays Afrique)

DETECTION AUTOMATIQUE DU TYPE :
TDR : Termes de Reference / Terms of Reference / experts / H/J / hommes-jours
AO_PUBLIC : Appel d Offres / DAO / Instructions Soumissionnaires / IS / DPAO
AO_PRIVE : consultation sans bailleur public reconnu
FIDIC : FIDIC / Conditions Marche Travaux / Ingenieur Projet
DOSSIER_COMPLET : plusieurs sections distinctes (TDR+CCAP+IS)

MULTILINGUISME : Priorite FR puis AR puis EN. Extrais tout quelle que soit la langue.

R1-COMPLETUDE : Lis CHAQUE mot — annexes, tableaux, notes, formulaires. Zero omission.

R2-DEDUCTION INTELLIGENTE :
P3A/PADR/PACE → UE/Subvention | BIRD/IDA → BM/Pret | AFD → Pret concessionnel
BAD/AfDB → BAD/Pret | IsDB → Pret islamique | KfW → Don/Pret allemand
Autofinancement/fonds propres → Autofinancement
[a completer]/[insert] → est_template=true
6m→180j | 12m→365j | 18m→540j | semaines→x7j | jours ouvrables→x1.4j
60+15+15 H/J → total_hommes_jours=90 | dates debut+fin → calcule duree

R3-NORMALISATION :
Dates → JJ/MM/AAAA | montants → chiffre seul | devises → champ separe
Pourcentages → chiffre seul | durees → TOUJOURS duree_mois ET duree_jours

R4-BUDGET :
HT/TTC → prend HT | tranches → additionne | fourchette → valeur max
Absent TDR → normal (CCAP) → note dans notes_extracteur

R5-EXPERTS (TOUS les sous-champs) :
code (EP1/EP2) | role (titre exact) | qualifications (liste complete)
experience_generale_ans | experience_specifique_ans | domaine_specifique
hommes_jours | langue | atouts (liste complete)

R6-COMPOSANTES : numero | titre | activites (liste COMPLETE sans omission)

R7-RAPPORTS : type | delai (texte exact) | pages_max | contenu | format

R8-LOTS : numero | titre | description | budget_lot | delai_lot

R9-QUALIFICATION : critere | seuil (valeur exacte) | documents_requis (liste)

R10-ACRONYMES : Extrais TOUS. Si absent → deduis depuis connaissances.
Connus : TDR=Termes Reference | AO=Appel Offres | CCAP=Cahier Clauses Admin Particulieres
IS=Instructions Soumissionnaires | H/J=Hommes-Jours | HT=Hors Taxes

R11-RISQUES : {risque: description, mesure: attenuation}
R12-HYPOTHESES : texte complet

R13-NULLS : absent→null (jamais "") | liste vide→[] | pas de nouvelles cles

R14-QUALITE :
confiance : haute>85% / moyenne 60-85% / faible<60%
taux_remplissage_pct : % champs non-null (0-100)
champs_non_trouves : champs IMPORTANTS absents uniquement
incoherences : incoherences REELLES uniquement
notes_extracteur : expliquer absences logiques

RETOURNE UNIQUEMENT LE JSON — zero texte avant ou apres — toutes les cles presentes."""


# ==============================================================================
# CONSTRUCTION PROMPTS
# ==============================================================================

def _schema_str():
    return json.dumps(SCHEMA_JSON, ensure_ascii=False, separators=(",", ":"))


def prompt_groq(texte: str) -> str:
    return PROMPT_PRO + "\n\nSCHEMA:\n" + _schema_str() + "\n\nDOCUMENT:\n" + texte


def prompt_claude_cible(texte: str, champs_null: list) -> str:
    schema_cible = {k: SCHEMA_JSON[k] for k in champs_null if k in SCHEMA_JSON}
    schema_str   = json.dumps(schema_cible, ensure_ascii=False, separators=(",", ":"))
    return (PROMPT_PRO +
            "\n\nEXTRAIS UNIQUEMENT CES CHAMPS MANQUANTS :\n" + schema_str +
            "\n\nRETOURNE UNIQUEMENT LE JSON DE CES CHAMPS.\n\nDOCUMENT:\n" + texte[:12000])


# ==============================================================================
# UTILITAIRES
# ==============================================================================

def _formater_temps(s: float) -> str:
    return f"{s:.2f} s" if s < 60 else f"{int(s//60)} min {s%60:.1f} s"


def _parser_json(texte: str) -> dict:
    t = texte.strip()
    if t.startswith("```json"): t = t[7:]
    elif t.startswith("```"):   t = t[3:]
    if t.endswith("```"):       t = t[:-3]
    return json.loads(t.strip())


def _calculer_taux(j: dict) -> int:
    def compter(d):
        total, remplis = 0, 0
        for v in d.values():
            if isinstance(v, dict):
                t2, r2 = compter(v)
                total += t2; remplis += r2
            else:
                total += 1
                if v is not None and v != [] and v != {}:
                    remplis += 1
        return total, remplis
    t, r = compter(j)
    return round(r / t * 100) if t > 0 else 0


def _fusionner(j_groq: dict, j_claude: dict) -> dict:
    resultat = j_groq.copy()
    for cle, valeur in j_claude.items():
        if valeur is None or valeur == [] or valeur == {}:
            continue
        if not resultat.get(cle):
            resultat[cle] = valeur
        elif isinstance(valeur, list) and isinstance(resultat.get(cle), list):
            for item in valeur:
                if item not in resultat[cle]:
                    resultat[cle].append(item)
        elif isinstance(valeur, dict) and isinstance(resultat.get(cle), dict):
            for sk, sv in valeur.items():
                if sv and not resultat[cle].get(sk):
                    resultat[cle][sk] = sv
    taux = _calculer_taux(resultat)
    resultat["taux_remplissage_pct"] = taux
    resultat["confiance_extraction"] = (
        "haute" if taux > 85 else "moyenne" if taux > 60 else "faible"
    )
    return resultat


# ==============================================================================
# EXTRACTION GROQ
# ==============================================================================

def extraire_groq(texte: str) -> dict:

    from groq import Groq
    logger.info("Groq Llama 3.3 70B — extraction...")
    t0 = time.time()

    try:
        client   = Groq(api_key=CLE_GROQ)
        response = client.chat.completions.create(
            model       = MODELE_GROQ,
            messages    = [
                {"role": "system", "content": "Tu es un extracteur JSON expert. Retourne UNIQUEMENT du JSON valide."},
                {"role": "user",   "content": prompt_groq(texte)}
            ],
            max_tokens  = 8000,
            temperature = 0.0
        )

        temps = round(time.time() - t0, 2)
        ti    = response.usage.prompt_tokens
        to    = response.usage.completion_tokens
        j     = _parser_json(response.choices[0].message.content)
        taux  = _calculer_taux(j)
        j["taux_remplissage_pct"] = taux

        logger.info("Groq OK | taux=%d%% | tokens=%d | temps=%s", taux, ti+to, _formater_temps(temps))
        return {"succes": True, "json": j, "tokens": ti+to, "cout": 0.0, "temps": temps, "erreur": None}

    except json.JSONDecodeError as e:
        temps = round(time.time() - t0, 2)
        logger.error("Groq JSON error : %s", e)
        return {"succes": False, "json": {}, "tokens": 0, "cout": 0.0, "temps": temps, "erreur": str(e)}

    except Exception as e:
        temps = round(time.time() - t0, 2)
        logger.error("Groq error : %s", e)
        msg = "Cle API invalide" if "auth" in str(e).lower() else str(e)
        return {"succes": False, "json": {}, "tokens": 0, "cout": 0.0, "temps": temps, "erreur": msg}


# ==============================================================================
# EXTRACTION CLAUDE CIBLE
# ==============================================================================

def extraire_claude_cible(texte: str, champs_null: list) -> dict:

    import anthropic
    logger.info("Claude cible — %d champs manquants", len(champs_null))
    t0 = time.time()

    try:
        client   = anthropic.Anthropic(api_key=CLE_CLAUDE)
        response = client.messages.create(
            model      = MODELE_CLAUDE,
            max_tokens = 8000,
            messages   = [{"role": "user", "content": prompt_claude_cible(texte, champs_null)}]
        )

        temps = round(time.time() - t0, 2)
        ti    = response.usage.input_tokens
        to    = response.usage.output_tokens
        cout  = round((ti/1e6)*3.0 + (to/1e6)*15.0, 4)
        j     = _parser_json(response.content[0].text)

        logger.info("Claude OK | tokens=%d | cout=%.4f$ | temps=%s", ti+to, cout, _formater_temps(temps))
        return {"succes": True, "json": j, "tokens": ti+to, "cout": cout, "temps": temps, "erreur": None}

    except json.JSONDecodeError as e:
        temps = round(time.time() - t0, 2)
        logger.error("Claude JSON error : %s", e)
        return {"succes": False, "json": {}, "tokens": 0, "cout": 0.0, "temps": temps, "erreur": str(e)}

    except Exception as e:
        temps = round(time.time() - t0, 2)
        logger.error("Claude error : %s", e)
        msg = "Cle API invalide — set ANTHROPIC_API_KEY=sk-ant-..." if "401" in str(e) else str(e)
        return {"succes": False, "json": {}, "tokens": 0, "cout": 0.0, "temps": temps, "erreur": msg}


# ==============================================================================
# PIPELINE PRINCIPAL
# ==============================================================================

def pipeline(texte: str, lecture: dict) -> dict:

    print("\n" + "=" * 62)
    print("  TenderBolt — Groq + Claude cible")
    print("=" * 62)
    print(f"  Pages      : {lecture.get('nb_pages', '?')}")
    print(f"  Caracteres : {lecture.get('nb_caracteres', '?')}")
    print(f"  Tokens est.: ~{len(texte)//4:,}")

    resultats = {}

    # ── ETAPE 1 — Groq ────────────────────────────────────────────
    print("\n  ETAPE 1 — Groq Llama 3.3 70B (gratuit)")
    print("  " + "-" * 50)

    r_groq = extraire_groq(texte)

    if not r_groq["succes"]:
        print(f"  ERREUR Groq : {r_groq['erreur']}")
        print("  Passage direct a Claude...")
        r_claude = extraire_claude_cible(texte, list(SCHEMA_JSON.keys()))
        resultats["json_final"] = r_claude.get("json", {})
        resultats["niveaux"]    = ["claude_full"]
        resultats["claude"]     = r_claude
        _afficher_resume(resultats)
        return resultats

    j_groq = r_groq["json"]
    taux   = j_groq.get("taux_remplissage_pct", 0) or 0

    print(f"  Type document    : {j_groq.get('type_document', 'N/A')}")
    print(f"  Bailleur         : {j_groq.get('bailleur', 'N/A')}")
    print(f"  Pays             : {j_groq.get('pays', 'N/A')}")
    print(f"  Duree            : {j_groq.get('duree_mois', 'N/A')} mois")
    print(f"  Nb experts       : {j_groq.get('nb_experts', 'N/A')}")
    print(f"  Taux remplissage : {taux}%")
    print(f"  Tokens           : {r_groq['tokens']:,}")
    print(f"  Cout             : 0.0000 USD (GRATUIT)")
    print(f"  Temps            : {_formater_temps(r_groq['temps'])}")

    resultats["groq"] = r_groq

    manquants_critiques = [c for c in CHAMPS_CRITIQUES if not j_groq.get(c)]
    champs_null         = [c for c, v in j_groq.items()
                          if (v is None or v == [] or v == {}) and c in SCHEMA_JSON]

    if taux >= SEUIL_GROQ and not manquants_critiques:
        print(f"\n  Taux {taux}% >= {SEUIL_GROQ}% — Groq suffit")
        resultats["json_final"] = j_groq
        resultats["niveaux"]    = ["groq"]
        _afficher_resume(resultats)
        return resultats

    if manquants_critiques:
        print(f"\n  Champs critiques manquants : {manquants_critiques}")
    print(f"  Champs null a completer : {len(champs_null)}")

    # ── ETAPE 2 — Claude cible ────────────────────────────────────
    print(f"\n  ETAPE 2 — Claude Sonnet 4.6 (cible — {len(champs_null[:25])} champs)")
    print("  " + "-" * 50)

    r_claude = extraire_claude_cible(texte, champs_null[:25])
    resultats["claude"] = r_claude

    if r_claude["succes"]:
        json_final = _fusionner(j_groq, r_claude["json"])
        taux_final = json_final.get("taux_remplissage_pct", 0)

        print(f"  Taux remplissage : {taux_final}%")
        print(f"  Tokens           : {r_claude['tokens']:,}")
        print(f"  Cout             : {r_claude['cout']} USD")
        print(f"  Temps            : {_formater_temps(r_claude['temps'])}")

        resultats["json_final"] = json_final
        resultats["niveaux"]    = ["groq", "claude_cible"]
    else:
        print(f"  ERREUR Claude : {r_claude['erreur']}")
        resultats["json_final"] = j_groq
        resultats["niveaux"]    = ["groq"]

    _afficher_resume(resultats)
    return resultats


# ==============================================================================
# AFFICHAGE RESUME
# ==============================================================================

def _afficher_resume(r: dict):
    j            = r.get("json_final", {}) or {}
    cout_claude  = r.get("claude", {}).get("cout",  0.0) or 0.0
    temps_groq   = r.get("groq",   {}).get("temps", 0.0) or 0.0
    temps_claude = r.get("claude", {}).get("temps", 0.0) or 0.0

    print("\n" + "=" * 62)
    print("  RESUME FINAL")
    print("=" * 62)
    print(f"  Niveaux          : {' + '.join(r.get('niveaux', []))}")
    print(f"  Type document    : {j.get('type_document', 'N/A')}")
    print(f"  Reference        : {j.get('reference', 'N/A')}")
    print(f"  Titre            : {str(j.get('titre_document','N/A'))[:50]}")
    print(f"  Bailleur         : {j.get('bailleur', 'N/A')}")
    print(f"  Type financement : {j.get('type_financement', 'N/A')}")
    print(f"  Programme cadre  : {j.get('programme_cadre', 'N/A')}")
    print(f"  Pays             : {j.get('pays', 'N/A')}")
    print(f"  Pouvoir adj.     : {j.get('pouvoir_adjudicateur', {}).get('organisation', 'N/A')}")
    print(f"  Beneficiaire     : {j.get('beneficiaire', {}).get('organisation', 'N/A')}")
    print(f"  Duree            : {j.get('duree_mois', 'N/A')} mois / {j.get('duree_jours', 'N/A')} jours")
    print(f"  Date debut       : {j.get('date_debut_prevue', 'N/A')}")
    print(f"  Nb experts       : {j.get('nb_experts', 'N/A')}")
    print(f"  Total H/J        : {j.get('total_hommes_jours', 'N/A')}")
    print(f"  Composantes      : {len(j.get('composantes', []))}")
    print(f"  Rapports         : {len(j.get('rapports', []))}")
    print(f"  Acronymes        : {len(j.get('acronymes', {}))}")
    print()
    print(f"  Confiance        : {j.get('confiance_extraction', 'N/A')}")
    print(f"  Taux remplissage : {j.get('taux_remplissage_pct', 'N/A')}%")
    print()
    print(f"  Cout Groq        : 0.0000 USD (GRATUIT)")
    print(f"  Cout Claude      : {cout_claude:.4f} USD")
    print(f"  COUT TOTAL       : {cout_claude:.4f} USD")
    print(f"  Temps Groq       : {_formater_temps(temps_groq)}")
    print(f"  Temps Claude     : {_formater_temps(temps_claude)}")
    print(f"  TEMPS TOTAL      : {_formater_temps(temps_groq + temps_claude)}")
    print("=" * 62)

    nom = f"extraction_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(nom, "w", encoding="utf-8") as f:
        json.dump(j, f, ensure_ascii=False, indent=2)
    print(f"\n  JSON sauvegarde : {nom}")


# ==============================================================================
# POINT D'ENTREE
# ==============================================================================

if __name__ == "__main__":

    if len(sys.argv) < 2:
        print("\nUsage   : python pipeline_groq_claude_pro.py DPs/TDR.pdf")
        print("Exemple : python pipeline_groq_claude_pro.py DPs/AO_ASECNA.pdf")
        sys.exit(1)

    chemin_dp = sys.argv[1]

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from Lecture.reader    import lire_document
    from Nettoyage.cleaner import nettoyer_texte

    lecture = lire_document(chemin_dp)
    if not lecture["succes"]:
        print("Erreur lecture : " + lecture["erreur"]); sys.exit(1)

    nettoyage = nettoyer_texte(lecture["texte"])
    if not nettoyage["succes"]:
        print("Erreur nettoyage : " + nettoyage["erreur"]); sys.exit(1)

    pipeline(nettoyage["texte_nettoye"], lecture)