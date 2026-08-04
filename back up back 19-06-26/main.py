import os
import sys
import json
import time
import logging
from datetime import datetime
from pathlib import Path

logging.basicConfig(
    level  = logging.INFO,
    format = "%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt= "%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("ProjectIQ.Main")

from Lecture.reader       import lire_document
from Nettoyage.cleaner    import nettoyer_texte
from Extraction.extractor import extraire_apo, sauvegarder_json
from Remplissage.formulaire import remplir_template


BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
DOSSIER_JSON = os.path.join(BASE_DIR, "Resultats")
CLE_API      = os.getenv("ANTHROPIC_API_KEY","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")



# ==============================================================================
# UTILITAIRE TEMPS
# ==============================================================================

def _formater_temps(secondes: float) -> str:
    """Convertit les secondes en format lisible automatiquement."""
    if secondes < 60:
        return f"{secondes:.3f} s"
    minutes = int(secondes // 60)
    secs    = secondes % 60
    return f"{minutes} min {secs:.1f} s"




def traiter_dp(chemin_dp: str) -> dict:
    """Execute le pipeline complet sur un dossier de projet."""

    nom_fichier = Path(chemin_dp).stem
    horodatage  = datetime.now().strftime("%Y%m%d_%H%M%S")
    chemin_json = os.path.join(DOSSIER_JSON, nom_fichier + "_" + horodatage + ".json")

    _afficher_en_tete(chemin_dp)

    # Phase 1 — Lecture
    _afficher_phase(1, "Lecture du document")
    t0            = time.time()
    lecture       = lire_document(chemin_dp)
    temps_lecture = round(time.time() - t0, 3)

    if not lecture["succes"]:
        _afficher_erreur("Lecture", lecture["erreur"])
        return {"succes": False, "phase": "lecture", "erreur": lecture["erreur"]}

    _afficher_resultats_lecture(lecture, temps_lecture, chemin_dp)

    # Phase 2 — Nettoyage
    _afficher_phase(2, "Nettoyage et structuration")
    t0              = time.time()
    nettoyage       = nettoyer_texte(lecture["texte"])
    temps_nettoyage = round(time.time() - t0, 3)

    if not nettoyage["succes"]:
        _afficher_erreur("Nettoyage", nettoyage["erreur"])
        return {"succes": False, "phase": "nettoyage", "erreur": nettoyage["erreur"]}

    _afficher_resultats_nettoyage(nettoyage, temps_nettoyage)

    # Phase 3 — Extraction Claude
    _afficher_phase(3, "Extraction par Claude API")
    t0               = time.perf_counter()
    extraction       = extraire_apo(nettoyage["texte_nettoye"], CLE_API)   # ← extraire() pas extraire_apo()
    temps_extraction = round(time.perf_counter() - t0, 3)
 
    if not extraction["succes"]:
        _afficher_erreur("Extraction", extraction["erreur"])
        return {"succes": False, "phase": "extraction", "erreur": extraction["erreur"]}
 
    _afficher_resultats_extraction(extraction, temps_extraction)
 
    # Sauvegarde JSON
    os.makedirs(DOSSIER_JSON, exist_ok=True)
    sauvegarder_json(extraction["json_extrait"], chemin_json)   # ← sauvegarder() pas sauvegarder_json()

    # Phase 4 — Génération formulaire
    remplir_template(
    json_path    = chemin_json,
    template_path= "APO-Formulaire_Etudes-Template.docx",
    output_docx  = chemin_json.replace(".json", ".docx"),
    output_pdf   = chemin_json.replace(".json", ".pdf")
    )
 
    # Résumé final
    temps_total = round(temps_lecture + temps_nettoyage + temps_extraction, 3)
    _afficher_pied_de_page(chemin_json, extraction, temps_total)
 
    return {
        "succes"    : True,
        "lecture"   : lecture,
        "nettoyage" : nettoyage,
        "extraction": extraction,
        "json_path" : chemin_json
    }

    





# ==============================================================================
# AFFICHAGE
# ==============================================================================

def _afficher_en_tete(chemin: str):
    print()
    print("=" * 62)
    print("  ProjectIQ — Pipeline Analyse Dossiers de Projets")
    print("=" * 62)
    print(f"  Fichier  : {chemin}")
    print(f"  Heure    : {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    print("=" * 62)


def _afficher_phase(numero: int, titre: str):
    print(f"\n  PHASE {numero} — {titre}")
    print("  " + "-" * 50)


def _afficher_erreur(phase: str, message: str):
    print(f"\n  ERREUR [{phase}] : {message}")
    print("=" * 62)


def _formater_taille(chemin: str) -> str:
    octets = os.path.getsize(chemin)
    if octets < 1024:
        return f"{octets} octets"
    elif octets < 1024 * 1024:
        return f"{octets / 1024:.1f} KB"
    else:
        return f"{octets / (1024 * 1024):.2f} MB"


def _afficher_resultats_lecture(lecture: dict, temps: float, chemin: str = ""):
    if chemin:
        print(f"  Taille        : {_formater_taille(chemin)}")
    print(f"  Methode       : {lecture['methode']}")
    print(f"  Pages         : {lecture['nb_pages']}")
    print(f"  Mots          : {lecture['nb_mots']}")
    print(f"  Caracteres    : {lecture['nb_caracteres']}")
    print(f"  Temps         : {_formater_temps(temps)}")


def _afficher_resultats_nettoyage(nettoyage: dict, temps: float):
    s = nettoyage["stats"]
    print(f"  Avant         : {s['avant']['nb_caracteres']} caracteres")
    print(f"  Apres         : {s['apres']['nb_caracteres']} caracteres")
    print(f"  Reduction     : {s['reduction_pct']}%")
    sections = [k for k in nettoyage["sections"].keys() if k != "__complet__"]
    print(f"  Sections      : {len(sections)} detectees")
    if sections:
        noms  = ", ".join(sections[:5])
        suite = "..." if len(sections) > 5 else ""
        print(f"  Noms          : {noms}{suite}")
    print(f"  Temps         : {_formater_temps(temps)}")


def _afficher_resultats_extraction(extraction: dict, temps: float):
    # 1. On récupère le JSON en sécurité (pour éviter les N/A si possible)
    j = extraction.get("json_extrait", {})
    if not isinstance(j, dict): j = {}

    # 2. Affichage des infos du projet (Titre, Pays, etc.)
    print(f"  Type document : {j.get('type_document', 'N/A')}")
    print(f"  Reference     : {j.get('reference', 'N/A')}")
    print(f"  Titre         : {(j.get('titre_document') or 'N/A')[:55]}")
    print(f"  Pays          : {j.get('pays', 'N/A')}")
    print(f"  Bailleur      : {j.get('bailleur', 'N/A')}")
    
    # Sécurité pour le dictionnaire imbriqué de l'organisation
    pouvoir = j.get('pouvoir_adjudicateur', {})
    org = pouvoir.get('organisation', 'N/A') if isinstance(pouvoir, dict) else 'N/A'
    print(f"  Pouvoir adj.  : {org}")
    
    print(f"  Duree         : {j.get('duree_mois', 'N/A')} mois")
    print(f"  Date debut    : {j.get('date_debut_prevue', 'N/A')}")
    print(f"  Nb experts    : {j.get('nb_experts', 'N/A')}")
    print(f"  Hommes/jours  : {j.get('total_hommes_jours', 'N/A')}")
    print()
    print(f"  Confiance     : {j.get('confiance_extraction', 'N/A')}")
    print(f"  Remplissage   : {j.get('taux_remplissage_pct', 'N/A')}%")
    print()

    # 3. AFFICHAGE TECHNIQUE (LA CORRECTION DU CRASH EST ICI)
    # On utilise .get() avec une valeur par défaut pour ne plus jamais planter
    t_in  = extraction.get('tokens_in', 0)
    t_out = extraction.get('tokens_out', 0)
    t_tot = extraction.get('tokens_total', 0)
    cout  = extraction.get('cout_estime_usd', 0.0)

    print(f"  Tokens input  : {t_in:,}")
    print(f"  Tokens output : {t_out:,}")
    print(f"  Tokens total  : {t_tot:,}")
    print(f"  Cout estime   : {cout} USD")
    print(f"  Temps         : {_formater_temps(temps)}")
    
    vitesse = round(t_tot / temps, 0) if temps > 0 else 0
    print(f"  Vitesse       : {vitesse:.0f} tokens/s")

    # 4. Champs manquants et notes
    champs = j.get("champs_non_trouves", [])
    if champs:
        print(f"\n  Champs abs.   : {len(champs)} champs non trouves")
    
    notes = j.get("notes_extracteur")
    if notes:
        print(f"  Note          : {notes[:80]}...")

def _afficher_pied_de_page(chemin_json: str, extraction: dict, temps_total: float):
    j = extraction["json_extrait"]
    print()
    print("=" * 62)
    print("  RESUME FINAL")
    print("=" * 62)
    print(f"  Temps total      : {_formater_temps(temps_total)}")
    print(f"  Tokens total     : {extraction.get('tokens_total', 0):,}")
    print(f"  Cout total       : {extraction.get('cout_usd', 0.0)} USD")
    print(f"  Confiance        : N/A")
    print(f"  Taux remplissage : N/A%")
    print()
    print(f"  JSON sauvegarde  : {chemin_json}")
    print(f"  Prochaine etape  : Phase 4 — Regles metier GO/NO GO")
    print("=" * 62)
    print()



if __name__ == "__main__":

    if len(sys.argv) < 2:
        print("\nUsage   : python main.py <chemin_dp>")
        print("Exemple : python main.py DPs/TDR.pdf")
        sys.exit(1)

    chemin_dp = sys.argv[1]

    if not os.path.isabs(chemin_dp):
        chemin_dp = os.path.join(BASE_DIR, chemin_dp)

    resultat = traiter_dp(chemin_dp)
    sys.exit(0 if resultat["succes"] else 1)