"""
TenderBolt — Test Triple LLM
Groq + Gemini + Claude sur TDR reel
Compare qualite / tokens / cout / temps
"""

import os
import sys
import json
import time
import logging
from datetime import datetime

logging.basicConfig(
    level  = logging.INFO,
    format = "%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("TenderBolt.TestLLM")

# ── Cles API ───────────────────────────────────────────────────────────────────
CLE_GROQ   = os.environ.get("GROQ_API_KEY",     "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")
CLE_GEMINI = os.environ.get("GEMINI_API_KEY",   "AIzaSyBg42vLbaDbohOC_THEWcpaJ3w4USDq188")
CLE_CLAUDE = os.environ.get("ANTHROPIC_API_KEY","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")

# ── Prompt compact identique pour les 3 LLMs ──────────────────────────────────
SCHEMA = {
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

PROMPT_BASE = """Tu es un expert international senior specialise dans l'analyse et l'extraction d'informations des dossiers de projets de cooperation internationale et des marches publics. Tu possedes une expertise approfondie sur les documents suivants : Termes de Reference (TDR), Appels d'Offres publics et prives (AO/DAO), contrats FIDIC, Dossiers de Consultation des Entreprises (DCE), et dossiers complets (TDR+CCAP+IS+annexes).

EXPERTISE GEOGRAPHIQUE ET INSTITUTIONNELLE :
Afrique du Nord : Tunisie, Maroc, Algerie, Libye, Egypte
Afrique subsaharienne : Senegal, Cote d'Ivoire, Cameroun, Madagascar, Mali, Niger
Moyen-Orient : Jordanie, Liban, Mauritanie

BAILLEURS DE FONDS RECONNUS :
UE | AFD | BM/BIRD/IDA | BAD/AfDB | PNUD | BEI | FIDA | USAID | KfW | JICA | IsDB | BADEA | BOAD | GIZ | AECID

PROGRAMMES :
P3A/PADR/PACE/ENPARD (UE-Tunisie) | PISEAU | PAPS | MCA/COMPACT | MEDA | PNDES

ENTITES :
Tunisie : UGP3A, MEP, MARHP, DGEDA, ANPE, ONAS, STEG, SONEDE
Maroc : ONEE, ONE, ORMVAH, ANRT, ADM | Algerie : SONELGAZ, ADE, SONATRACH
Regional : ASECNA (20 pays Afrique), UA, CEDEAO, UMA

DETECTION TYPE :
TDR : Termes de Reference / experts / H/J / hommes-jours
AO_PUBLIC : Appel d Offres / DAO / IS / DPAO / Instructions Soumissionnaires
AO_PRIVE : appel offres sans bailleur public reconnu
FIDIC : FIDIC / Conditions Marche Travaux / Ingenieur Projet
DOSSIER_COMPLET : plusieurs sections (TDR+CCAP+IS+formulaires)

MULTILINGUISME : Priorite FR puis AR puis EN. Documents melanges : extrais tout.

R1-COMPLETUDE : Lis CHAQUE mot - annexes, tableaux, notes, formulaires. Zero omission.

R2-DEDUCTION :
P3A/PADR/PACE → UE/Subvention | BIRD/IDA → BM/Pret | AFD → Pret concessionnel
BAD/AfDB → BAD/Pret | IsDB → Pret islamique | KfW → Don/Pret allemand
Autofinancement/fonds propres → Autofinancement | [a completer] partout → est_template=true
6m→180j | 12m→365j | 18m→540j | 24m→720j | semaines→x7j | jours ouvrables→x1.4j
60+15+15 H/J → total=90 | dates debut+fin → calcule duree | deduire pays depuis organisation

R3-NORMALISATION :
Dates → JJ/MM/AAAA | montants → chiffre seul | devises → champ separe
Pourcentages → chiffre seul | durees → TOUJOURS duree_mois ET duree_jours

R4-BUDGET :
HT/TTC → prend HT | tranches/lots → additionne | fourchette → valeur max
Absent TDR → normal (CCAP separe) → note dans notes_extracteur

R5-EXPERTS (TOUS les sous-champs obligatoires) :
code | role (titre exact) | qualifications (liste complete)
experience_generale_ans | experience_specifique_ans | domaine_specifique
hommes_jours | langue (avec niveau) | atouts (liste complete)

R6-COMPOSANTES : numero | titre | activites (liste COMPLETE - phrases completes)

R7-RAPPORTS : type | delai (texte exact) | pages_max | contenu | format

R8-LOTS : numero | titre | description | budget_lot | delai_lot

R9-QUALIFICATION : critere | seuil (valeur exacte) | documents_requis (liste)

R10-ACRONYMES (TOUS sans exception) :
Dans le doc → utilise la signification du doc
Absent → deduis depuis connaissances
Connus : TDR=Termes Reference | AO=Appel Offres | DAO=Dossier AO
CCAP=Cahier Clauses Admin Particulieres | CCAG=Cahier Clauses Admin Generales
IS=Instructions Soumissionnaires | DPAO=Donnees Particulieres AO
H/J=Hommes-Jours | HT=Hors Taxes | TTC=Toutes Taxes Comprises
PAP=Programme Annuel Performance | RAP=Rapport Annuel Performance
SPS=Sanitaire Phytosanitaire | ESS=Economie Sociale Solidaire

R11-RISQUES : {risque: description complete, mesure: attenuation complete}
R12-HYPOTHESES : texte complet de chaque hypothese

R13-FIDIC : cautionnement_pct | penalites_retard (formule exacte) | delai_paiement_jours

R14-DOSSIER COMPLET : TDR → experts/composantes/rapports | CCAP → budget/garanties/penalites

R15-NULLS : absent → null (jamais "" jamais "N/A") | liste vide → [] | pas de nouvelles cles

R16-QUALITE :
confiance : haute>85% / moyenne 60-85% / faible<60%
taux_remplissage_pct : % champs non-null (0-100)
champs_non_trouves : champs IMPORTANTS absents uniquement
incoherences : incoherences REELLES uniquement
notes_extracteur : expliquer SYSTEMATIQUEMENT les absences importantes

RETOURNE UNIQUEMENT LE JSON - zero texte avant ou apres - toutes les cles presentes.

SCHEMA:
"""

def construire_prompt(texte: str) -> str:
    schema_str = json.dumps(SCHEMA, ensure_ascii=False, separators=(",", ":"))
    return PROMPT_BASE + schema_str + "\n\nDOCUMENT:\n" + texte


# ==============================================================================
# EXTRACTION PAR LLM
# ==============================================================================

def extraire_groq(texte: str) -> dict:
    """Extraction via Groq — Llama 3.3 70B."""
    from groq import Groq

    t0     = time.time()
    client = Groq(api_key=CLE_GROQ)

    response = client.chat.completions.create(
        model      = "llama-3.3-70b-versatile",
        messages   = [{"role": "user", "content": construire_prompt(texte)}],
        max_tokens = 8000
    )

    temps      = round(time.time() - t0, 2)
    tokens_in  = response.usage.prompt_tokens
    tokens_out = response.usage.completion_tokens
    cout       = round((tokens_in/1e6)*0.05 + (tokens_out/1e6)*0.08, 4)

    return _formater(response.choices[0].message.content, "Groq Llama 3.3 70B",
                     tokens_in, tokens_out, cout, temps)


def extraire_gemini(texte: str) -> dict:
    from google import genai
    from google.genai import types

    t0     = time.time()
    client = genai.Client(api_key=CLE_GEMINI)

    response = client.models.generate_content(
        model    = "gemini-2.0-flash",
        contents = construire_prompt(texte)
    )

    temps      = round(time.time() - t0, 2)
    tokens_in  = len(construire_prompt(texte)) // 4
    tokens_out = len(response.text) // 4
    cout       = round((tokens_in/1e6)*0.10 + (tokens_out/1e6)*0.40, 4)

    return _formater(response.text, "Gemini 2.0 Flash",
                     tokens_in, tokens_out, cout, temps)


def extraire_claude(texte: str) -> dict:
    """Extraction via Claude Sonnet 4.6."""
    import anthropic

    t0       = time.time()
    client   = anthropic.Anthropic(api_key=CLE_CLAUDE)
    response = client.messages.create(
        model      = "claude-sonnet-4-6",
        max_tokens = 8000,
        messages   = [{"role": "user", "content": construire_prompt(texte)}]
    )

    temps      = round(time.time() - t0, 2)
    tokens_in  = response.usage.input_tokens
    tokens_out = response.usage.output_tokens
    cout       = round((tokens_in/1e6)*3.0 + (tokens_out/1e6)*15.0, 4)

    return _formater(response.content[0].text, "Claude Sonnet 4.6",
                     tokens_in, tokens_out, cout, temps)


def extraire_claude_cible(texte_sections: str) -> dict:
    """Claude uniquement sur les sections manquantes — mode cible."""
    import anthropic

    t0       = time.time()
    client   = anthropic.Anthropic(api_key=CLE_CLAUDE)
    response = client.messages.create(
        model      = "claude-sonnet-4-6",
        max_tokens = 4000,
        messages   = [{"role": "user", "content": construire_prompt(texte_sections)}]
    )

    temps      = round(time.time() - t0, 2)
    tokens_in  = response.usage.input_tokens
    tokens_out = response.usage.output_tokens
    cout       = round((tokens_in/1e6)*3.0 + (tokens_out/1e6)*15.0, 4)

    return _formater(response.content[0].text, "Claude Sonnet 4.6 (cible)",
                     tokens_in, tokens_out, cout, temps)


# ==============================================================================
# UTILITAIRES
# ==============================================================================

def _formater(texte_reponse: str, llm: str, ti: int, to: int,
              cout: float, temps: float) -> dict:
    """Parse le JSON et formate le resultat."""
    t = texte_reponse.strip()
    if t.startswith("```json"): t = t[7:]
    elif t.startswith("```"):   t = t[3:]
    if t.endswith("```"):       t = t[:-3]

    try:
        j = json.loads(t.strip())
        taux = j.get("taux_remplissage_pct", 0) or 0
        logger.info("OK | %-30s | taux=%s%% | tokens=%d | cout=%.4f$ | temps=%.2fs",
                    llm, taux, ti+to, cout, temps)
        return {
            "succes": True, "json_extrait": j, "llm": llm,
            "tokens_input": ti, "tokens_output": to,
            "tokens_total": ti + to, "cout": cout,
            "temps": temps, "erreur": None
        }
    except json.JSONDecodeError as e:
        logger.error("ERREUR JSON | %s | %s", llm, str(e))
        return {
            "succes": False, "json_extrait": None, "llm": llm,
            "tokens_input": ti, "tokens_output": to,
            "tokens_total": ti + to, "cout": cout,
            "temps": temps, "erreur": str(e)
        }


def _formater_temps(secondes: float) -> str:
    if secondes < 60:
        return f"{secondes:.2f} s"
    return f"{int(secondes//60)} min {secondes%60:.1f} s"


def _champs_manquants(j: dict) -> list:
    """Retourne les champs importants null."""
    CHAMPS_IMPORTANTS = [
        "type_document", "bailleur", "pays", "reference",
        "titre_document", "duree_mois", "nb_experts",
        "total_hommes_jours", "budget_total", "date_limite_soumission"
    ]
    return [c for c in CHAMPS_IMPORTANTS if not j.get(c)]


# ==============================================================================
# PIPELINE TRIPLE
# ==============================================================================

def pipeline_triple(texte: str) -> dict:
    """
    Pipeline hybride Groq → Gemini → Claude cible.
    Chaque niveau intervient seulement si necessaire.
    """

    print("\n" + "=" * 65)
    print("  PIPELINE TRIPLE : Groq + Gemini + Claude cible")
    print("=" * 65)

    resultats = {}

    # ── Niveau 1 — Groq ────────────────────────────────────────────
    print("\n  NIVEAU 1 — Groq Llama 3.3 70B (gratuit)")
    print("  " + "-" * 50)

    r_groq = extraire_groq(texte)
    resultats["groq"] = r_groq

    if r_groq["succes"]:
        taux = r_groq["json_extrait"].get("taux_remplissage_pct", 0) or 0
        print(f"  Taux remplissage : {taux}%")
        print(f"  Tokens           : {r_groq['tokens_total']:,}")
        print(f"  Cout             : {r_groq['cout']} USD")
        print(f"  Temps            : {_formater_temps(r_groq['temps'])}")

        if taux >= 85:
            print("\n  Taux > 85% — Groq suffit — pipeline arrete")
            resultats["json_final"] = r_groq["json_extrait"]
            resultats["niveaux_utilises"] = ["groq"]
            return resultats
    else:
        print(f"  ERREUR : {r_groq['erreur']}")

    # ── Niveau 2 — Gemini ──────────────────────────────────────────
    print("\n  NIVEAU 2 — Gemini 2.5 Flash")
    print("  " + "-" * 50)

    r_gemini = extraire_gemini(texte)
    resultats["gemini"] = r_gemini

    if r_gemini["succes"]:
        taux = r_gemini["json_extrait"].get("taux_remplissage_pct", 0) or 0
        print(f"  Taux remplissage : {taux}%")
        print(f"  Tokens           : {r_gemini['tokens_total']:,}")
        print(f"  Cout             : {r_gemini['cout']} USD")
        print(f"  Temps            : {_formater_temps(r_gemini['temps'])}")

        manquants = _champs_manquants(r_gemini["json_extrait"])
        if not manquants or taux >= 90:
            print("\n  Taux > 90% — Gemini suffit — pipeline arrete")
            resultats["json_final"] = r_gemini["json_extrait"]
            resultats["niveaux_utilises"] = ["groq", "gemini"]
            return resultats

        print(f"  Champs critiques manquants : {manquants}")
    else:
        print(f"  ERREUR : {r_gemini['erreur']}")

    # ── Niveau 3 — Claude cible ────────────────────────────────────
    print("\n  NIVEAU 3 — Claude Sonnet 4.6 (cible)")
    print("  " + "-" * 50)

    # Envoyer seulement le texte pertinent a Claude
    texte_cible = texte[:5000]  # sections debut = plus riches en info
    r_claude = extraire_claude_cible(texte_cible)
    resultats["claude_cible"] = r_claude

    if r_claude["succes"]:
        taux = r_claude["json_extrait"].get("taux_remplissage_pct", 0) or 0
        print(f"  Taux remplissage : {taux}%")
        print(f"  Tokens           : {r_claude['tokens_total']:,}")
        print(f"  Cout             : {r_claude['cout']} USD")
        print(f"  Temps            : {_formater_temps(r_claude['temps'])}")
        resultats["json_final"] = r_claude["json_extrait"]
    else:
        print(f"  ERREUR : {r_claude['erreur']}")
        resultats["json_final"] = r_gemini.get("json_extrait") or r_groq.get("json_extrait")

    resultats["niveaux_utilises"] = ["groq", "gemini", "claude_cible"]
    return resultats


# ==============================================================================
# COMPARAISON COMPLETE
# ==============================================================================

def comparaison_complete(texte: str):
    """Compare les 3 LLMs independamment sur le meme document."""

    print("\n" + "=" * 65)
    print("  COMPARAISON COMPLETE — 3 LLMs en parallele")
    print("=" * 65)

    resultats = {}

    # Extraction par chaque LLM
    for nom, fn in [("groq", extraire_groq),
                    ("gemini", extraire_gemini),
                    ("claude", extraire_claude)]:
        print(f"\n  Extraction {nom.upper()}...")
        try:
            resultats[nom] = fn(texte)
        except Exception as e:
            print(f"  ERREUR {nom} : {str(e)}")
            resultats[nom] = {"succes": False, "erreur": str(e)}

    # Rapport comparatif
    print("\n" + "=" * 65)
    print("  RAPPORT COMPARATIF")
    print("=" * 65)

    CHAMPS_CLE = [
        "type_document", "bailleur", "pays", "reference",
        "duree_mois", "nb_experts", "total_hommes_jours",
        "confiance_extraction", "taux_remplissage_pct"
    ]

    print("%-28s %-18s %-18s %-18s" % ("Champ", "Groq", "Gemini", "Claude"))
    print("-" * 65)

    for champ in CHAMPS_CLE:
        vals = {}
        for nom in ["groq", "gemini", "claude"]:
            r = resultats.get(nom, {})
            if r.get("succes") and r.get("json_extrait"):
                vals[nom] = str(r["json_extrait"].get(champ, "null"))[:17]
            else:
                vals[nom] = "ERREUR"

        print("%-28s %-18s %-18s %-18s" % (
            champ[:27], vals.get("groq","—"),
            vals.get("gemini","—"), vals.get("claude","—")))

    # Tableau performance
    print("\n" + "-" * 65)
    print("%-28s %-18s %-18s %-18s" % ("PERFORMANCE", "Groq", "Gemini", "Claude"))
    print("-" * 65)

    for metrique, cle in [("Tokens total", "tokens_total"),
                           ("Cout USD", "cout"),
                           ("Temps", "temps")]:
        vals = {}
        for nom in ["groq", "gemini", "claude"]:
            r = resultats.get(nom, {})
            if r.get("succes"):
                v = r.get(cle, 0)
                if cle == "temps":
                    vals[nom] = _formater_temps(v)
                elif cle == "cout":
                    vals[nom] = f"{v:.4f}$"
                else:
                    vals[nom] = f"{v:,}"
            else:
                vals[nom] = "ERREUR"

        print("%-28s %-18s %-18s %-18s" % (
            metrique, vals.get("groq","—"),
            vals.get("gemini","—"), vals.get("claude","—")))

    # Economie
    r_claude = resultats.get("claude", {})
    r_groq   = resultats.get("groq", {})
    r_gemini = resultats.get("gemini", {})

    if r_claude.get("succes") and r_groq.get("succes"):
        eco_groq = round((1 - r_groq["cout"] / r_claude["cout"]) * 100, 1)
        print("\n  Economie Groq vs Claude    : %s%%" % eco_groq)
    if r_claude.get("succes") and r_gemini.get("succes"):
        eco_gemini = round((1 - r_gemini["cout"] / r_claude["cout"]) * 100, 1)
        print("  Economie Gemini vs Claude  : %s%%" % eco_gemini)

    print("=" * 65)

    # Sauvegarde
    horodatage = datetime.now().strftime("%Y%m%d_%H%M%S")
    chemin     = f"comparaison_llms_{horodatage}.json"
    with open(chemin, "w", encoding="utf-8") as f:
        json.dump({
            k: {
                "llm"    : v.get("llm"),
                "succes" : v.get("succes"),
                "tokens" : v.get("tokens_total"),
                "cout"   : v.get("cout"),
                "temps"  : v.get("temps"),
                "json"   : v.get("json_extrait")
            }
            for k, v in resultats.items()
        }, f, ensure_ascii=False, indent=2)

    print(f"\n  Resultats sauvegardes : {chemin}")
    return resultats


# ==============================================================================
# POINT D'ENTREE
# ==============================================================================

if __name__ == "__main__":

    if len(sys.argv) < 2:
        print("\nUsage :")
        print("  python test_triple_llm.py DPs/TDR.pdf            # pipeline hybride")
        print("  python test_triple_llm.py DPs/TDR.pdf --comparer # comparaison 3 LLMs")
        sys.exit(1)

    chemin_dp = sys.argv[1]
    mode      = "--comparer" in sys.argv

    # Lecture du document
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from Lecture.reader    import lire_document
    from Nettoyage.cleaner import nettoyer_texte

    print(f"\nLecture : {chemin_dp}")
    lecture = lire_document(chemin_dp)
    if not lecture["succes"]:
        print("Erreur lecture : " + lecture["erreur"])
        sys.exit(1)

    nettoyage = nettoyer_texte(lecture["texte"])
    if not nettoyage["succes"]:
        print("Erreur nettoyage : " + nettoyage["erreur"])
        sys.exit(1)

    texte = nettoyage["texte_nettoye"]
    print(f"Pages      : {lecture['nb_pages']}")
    print(f"Caracteres : {lecture['nb_caracteres']}")

    if mode:
        # Mode comparaison — les 3 LLMs en independant
        comparaison_complete(texte)
    else:
        # Mode pipeline hybride — Groq → Gemini → Claude cible
        r = pipeline_triple(texte)

        print("\n" + "=" * 65)
        print("  RESUME PIPELINE TRIPLE")
        print("=" * 65)
        print("Niveaux utilises : " + " → ".join(r.get("niveaux_utilises", [])))

        cout_total = sum(
            r.get(n, {}).get("cout", 0)
            for n in ["groq", "gemini", "claude_cible"]
        )
        temps_total = sum(
            r.get(n, {}).get("temps", 0)
            for n in ["groq", "gemini", "claude_cible"]
        )

        print("Cout total       : %.4f USD" % cout_total)
        print("Temps total      : " + _formater_temps(temps_total))

        if r.get("json_final"):
            j = r["json_final"]
            print("Type document    : " + str(j.get("type_document")))
            print("Bailleur         : " + str(j.get("bailleur")))
            print("Confiance        : " + str(j.get("confiance_extraction")))
            print("Taux remplissage : " + str(j.get("taux_remplissage_pct")) + "%")

        print("=" * 65)