"""
TenderBolt — Pipeline Groq + Claude cible
Groq Llama 3.3 70B (gratuit) → Claude Sonnet cible si necessaire
"""

import os
import sys
import json
import time
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("TenderBolt.GroqClaude")

CLE_GROQ    = os.environ.get("GROQ_API_KEY",     "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")
CLE_CLAUDE  = os.environ.get("ANTHROPIC_API_KEY","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")
MODELE_GROQ = "llama-3.3-70b-versatile"
MODELE_CLAUDE = "claude-sonnet-4-6"
SEUIL_GROQ  = 80   # si taux >= 80% → Groq suffit

CHAMPS_CRITIQUES = [
    "type_document", "bailleur", "pays", "reference",
    "titre_document", "duree_mois", "nb_experts",
    "total_hommes_jours", "programme_cadre"
]

SCHEMA_JSON = {
    "type_document": None, "est_template": None, "reference": None,
    "titre_document": None, "acronyme_mission": None, "langue": None,
    "date_publication": None, "date_limite_soumission": None,
    "nb_pages": None, "nb_lots": None,
    "pays": None, "region": None, "ville": None, "zone_intervention": [],
    "pouvoir_adjudicateur": {
        "organisation": None, "acronyme": None, "structure": None,
        "acronyme_structure": None, "adresse": None, "telephone": None,
        "email": None, "site_web": None, "contact_nom": None
    },
    "bailleur": None, "type_financement": None, "programme_cadre": None,
    "contrat_cadre": None,
    "beneficiaire": {
        "organisation": None, "acronyme": None,
        "direction": None, "acronyme_direction": None, "pays": None
    },
    "programmes_connexes": [], "secteurs": [], "mots_cles": [],
    "contexte": [], "acronymes": {},
    "objectif_general": None, "objectifs_specifiques": [],
    "duree_mois": None, "duree_jours": None,
    "date_debut_prevue": None, "date_fin_prevue": None,
    "nb_experts": None, "total_hommes_jours": None, "experts": [],
    "lots": [], "composantes": [],
    "produits_attendus": [], "livrables": [], "rapports": [],
    "budget_total": None, "devise": None, "avance_pct": None,
    "garantie_soumission_pct": None, "penalites_retard": None,
    "modalites_paiement": None, "validite_offre_jours": None,
    "type_evaluation": None, "poids_technique_pct": None,
    "poids_financier_pct": None, "criteres_evaluation": [],
    "qualification_requise": [], "documents_requis": [],
    "logistique": {
        "lieu_principal": None, "deplacements": None,
        "bureaux": None, "equipement": None, "formation_requise": None
    },
    "gestion_projet": {
        "organe_responsable": None, "supervision": None,
        "comite_suivi": None, "reunions": None
    },
    "risques": [], "hypotheses": [],
    "confiance_extraction": None, "taux_remplissage_pct": None,
    "champs_non_trouves": [], "incoherences": [], "notes_extracteur": None
}

PROMPT_BASE = """Tu es un expert senior en analyse de dossiers de projets de cooperation internationale.
Maitrise : TDR, AO public/prive, FIDIC, dossiers complets.
Langues : Francais (priorite), Arabe, Anglais, melanges.
Bailleurs : UE/P3A/PADR/PACE, BM/BIRD/IDA, AFD, BAD, PNUD, IsDB, KfW, JICA, Autofinancement.
Entites : UGP3A, MEP, MARHP, DGEDA, ASECNA, ONAS, STEG, ONEE, ORMVAH.

DETECTION TYPE :
TDR : Termes de Reference / experts / H/J
AO_PUBLIC : Appel d Offres / DAO / Instructions Soumissionnaires
FIDIC : FIDIC / Conditions Marche Travaux
DOSSIER_COMPLET : TDR + CCAP + IS

REGLES :
R1 Lis TOUT — zero omission
R2 Deduis : P3A→UE/Subvention | BIRD/IDA→BM/Pret | AFD→Pret concessionnel
   BAD→BAD/Pret | fonds propres→Autofinancement | [a completer]→est_template=true
   6m→180j | 12m→365j | semaines→x7j | jours ouvrables→x1.4j
R3 Dates→JJ/MM/AAAA | montants→chiffre seul | devises→champ separe | pct→chiffre seul
   Remplis TOUJOURS duree_mois ET duree_jours
R4 Experts : code/role/qualifications(liste)/experience_generale_ans
   /experience_specifique_ans/domaine_specifique/hommes_jours/langue/atouts(liste)
R5 Composantes : numero/titre/activites(liste COMPLETE)
R6 Rapports : type/delai/pages_max/contenu/format
R7 absent→null | liste vide→[] | pas de nouvelles cles
R8 confiance : haute>85% / moyenne 60-85% / faible<60%
R9 taux_remplissage_pct : % champs non-null (0-100)
R10 notes_extracteur : expliquer absences logiques

RETOURNE UNIQUEMENT LE JSON — zero texte avant ou apres."""


def construire_prompt(texte: str) -> str:
    schema_str = json.dumps(SCHEMA_JSON, ensure_ascii=False, separators=(",", ":"))
    return PROMPT_BASE + "\n\nSCHEMA:\n" + schema_str + "\n\nDOCUMENT:\n" + texte


def construire_prompt_cible(texte: str, champs_null: list) -> str:
    schema_cible = {k: SCHEMA_JSON[k] for k in champs_null if k in SCHEMA_JSON}
    schema_str   = json.dumps(schema_cible, ensure_ascii=False, separators=(",", ":"))
    return (PROMPT_BASE +
        "\n\nEXTRAIS UNIQUEMENT CES CHAMPS MANQUANTS :\n" + schema_str +
        "\n\nRETOURNE UNIQUEMENT LE JSON DE CES CHAMPS.\n\nDOCUMENT:\n" + texte[:10000])


def _formater_temps(s: float) -> str:
    return f"{s:.2f} s" if s < 60 else f"{int(s//60)} min {s%60:.1f} s"


def _parser_json(texte: str) -> dict:
    t = texte.strip()
    if t.startswith("```json"): t = t[7:]
    elif t.startswith("```"):   t = t[3:]
    if t.endswith("```"):       t = t[:-3]
    return json.loads(t.strip())


def _calculer_taux(j: dict) -> int:
    """Calcule le taux de remplissage du JSON."""
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
    total, remplis = compter(j)
    return round(remplis / total * 100) if total > 0 else 0


def _fusionner(j_groq: dict, j_claude: dict) -> dict:
    """Fusionne les deux JSONs — Claude complete les null de Groq."""
    resultat = j_groq.copy()
    for cle, valeur in j_claude.items():
        if valeur is not None and valeur != [] and valeur != {}:
            if not resultat.get(cle):
                resultat[cle] = valeur
    taux = _calculer_taux(resultat)
    resultat["taux_remplissage_pct"] = taux
    resultat["confiance_extraction"] = (
        "haute" if taux > 85 else "moyenne" if taux > 60 else "faible"
    )
    return resultat


# ==============================================================================
# PIPELINE PRINCIPAL
# ==============================================================================

def pipeline_groq_claude(texte: str, lecture: dict) -> dict:

    print("\n" + "=" * 62)
    print("  PIPELINE Groq + Claude cible")
    print("=" * 62)
    print(f"  Pages      : {lecture.get('nb_pages', '?')}")
    print(f"  Caracteres : {lecture.get('nb_caracteres', '?')}")

    resultats = {}

    # ── ETAPE 1 — Groq ────────────────────────────────────────────
    print("\n  ETAPE 1 — Groq Llama 3.3 70B (gratuit)")
    print("  " + "-" * 50)

    from groq import Groq
    t0     = time.time()
    client = Groq(api_key=CLE_GROQ)

    try:
        response = client.chat.completions.create(
            model      = MODELE_GROQ,
            messages   = [
                {"role": "system", "content": "Retourne UNIQUEMENT du JSON valide."},
                {"role": "user",   "content": construire_prompt(texte)}
            ],
            max_tokens  = 8000,
            temperature = 0.0
        )

        temps_groq = round(time.time() - t0, 2)
        ti         = response.usage.prompt_tokens
        to         = response.usage.completion_tokens
        j_groq     = _parser_json(response.choices[0].message.content)
        taux_groq  = _calculer_taux(j_groq)
        j_groq["taux_remplissage_pct"] = taux_groq

        resultats["groq"] = {"json": j_groq, "tokens": ti+to, "cout": 0.0, "temps": temps_groq}

        print(f"  Type document    : {j_groq.get('type_document', 'N/A')}")
        print(f"  Bailleur         : {j_groq.get('bailleur', 'N/A')}")
        print(f"  Pays             : {j_groq.get('pays', 'N/A')}")
        print(f"  Duree            : {j_groq.get('duree_mois', 'N/A')} mois")
        print(f"  Nb experts       : {j_groq.get('nb_experts', 'N/A')}")
        print(f"  Taux remplissage : {taux_groq}%")
        print(f"  Tokens           : {ti+to:,}")
        print(f"  Cout             : 0.0000 USD (GRATUIT)")
        print(f"  Temps            : {_formater_temps(temps_groq)}")

        # Champs critiques manquants
        manquants_critiques = [c for c in CHAMPS_CRITIQUES if not j_groq.get(c)]
        champs_null = [c for c, v in j_groq.items()
                      if v is None and c in SCHEMA_JSON]

        if taux_groq >= SEUIL_GROQ and not manquants_critiques:
            print(f"\n  Taux {taux_groq}% >= {SEUIL_GROQ}% — Groq suffit")
            resultats["json_final"]  = j_groq
            resultats["niveaux"]     = ["groq"]
            _afficher_resume(resultats)
            return resultats

        if manquants_critiques:
            print(f"\n  Champs critiques manquants : {manquants_critiques}")
        print(f"  Taux {taux_groq}% < {SEUIL_GROQ}% — Claude complete les manquants")

    except Exception as e:
        temps_groq = round(time.time() - t0, 2)
        print(f"  ERREUR Groq : {e}")
        j_groq     = {}
        champs_null = list(SCHEMA_JSON.keys())

    # ── ETAPE 2 — Claude cible ────────────────────────────────────
    print(f"\n  ETAPE 2 — Claude Sonnet 4.6 ({len(champs_null)} champs cibles)")
    print("  " + "-" * 50)

    import anthropic
    t0       = time.time()
    client_c = anthropic.Anthropic(api_key=CLE_CLAUDE)

    try:
        response = client_c.messages.create(
            model      = MODELE_CLAUDE,
            max_tokens = 8000,
            messages   = [{"role": "user", "content": construire_prompt_cible(texte, champs_null[:25])}]
        )

        temps_claude = round(time.time() - t0, 2)
        ti_c         = response.usage.input_tokens
        to_c         = response.usage.output_tokens
        cout_claude  = round((ti_c/1e6)*3.0 + (to_c/1e6)*15.0, 4)
        j_claude     = _parser_json(response.content[0].text)

        # Fusion
        json_final = _fusionner(j_groq, j_claude) if j_groq else j_claude
        taux_final = json_final.get("taux_remplissage_pct", 0)

        resultats["claude"] = {"json": j_claude, "tokens": ti_c+to_c,
                               "cout": cout_claude, "temps": temps_claude}
        resultats["json_final"] = json_final
        resultats["niveaux"]    = ["groq", "claude_cible"]

        print(f"  Taux remplissage : {taux_final}%")
        print(f"  Tokens           : {ti_c+to_c:,}")
        print(f"  Cout             : {cout_claude} USD")
        print(f"  Temps            : {_formater_temps(temps_claude)}")

    except Exception as e:
        temps_claude = round(time.time() - t0, 2)
        print(f"  ERREUR Claude : {e}")
        resultats["json_final"] = j_groq
        resultats["niveaux"]    = ["groq"]

    _afficher_resume(resultats)
    return resultats


def _afficher_resume(r: dict):
    j          = r.get("json_final", {}) or {}
    cout_groq  = r.get("groq",   {}).get("cout",  0.0) or 0.0
    cout_claude= r.get("claude", {}).get("cout",  0.0) or 0.0
    temps_groq = r.get("groq",   {}).get("temps", 0.0) or 0.0
    temps_claude=r.get("claude", {}).get("temps", 0.0) or 0.0

    print("\n" + "=" * 62)
    print("  RESUME FINAL")
    print("=" * 62)
    print(f"  Niveaux          : {' + '.join(r.get('niveaux', []))}")
    print(f"  Type document    : {j.get('type_document', 'N/A')}")
    print(f"  Reference        : {j.get('reference', 'N/A')}")
    print(f"  Bailleur         : {j.get('bailleur', 'N/A')}")
    print(f"  Pays             : {j.get('pays', 'N/A')}")
    print(f"  Duree            : {j.get('duree_mois', 'N/A')} mois")
    print(f"  Nb experts       : {j.get('nb_experts', 'N/A')}")
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

    nom = f"groq_claude_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(nom, "w", encoding="utf-8") as f:
        json.dump(j, f, ensure_ascii=False, indent=2)
    print(f"\n  JSON sauvegarde : {nom}")


# ==============================================================================
# POINT D'ENTREE
# ==============================================================================

if __name__ == "__main__":
    chemin = sys.argv[1] if len(sys.argv) > 1 else "DPs/TDR.pdf"

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from Lecture.reader    import lire_document
    from Nettoyage.cleaner import nettoyer_texte

    lecture = lire_document(chemin)
    if not lecture["succes"]:
        print("Erreur lecture : " + lecture["erreur"]); sys.exit(1)

    nettoyage = nettoyer_texte(lecture["texte"])
    if not nettoyage["succes"]:
        print("Erreur nettoyage : " + nettoyage["erreur"]); sys.exit(1)

    pipeline_groq_claude(nettoyage["texte_nettoye"], lecture)