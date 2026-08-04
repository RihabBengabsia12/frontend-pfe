import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from datetime import datetime

# ── Helpers ───────────────────────────────────────────────────────────────────

def _str(val, fallback="N/R") -> str:
    """Convertit une valeur JSON en string propre."""
    if val is None:
        return fallback
    if isinstance(val, list):
        # Filtre les tirets déjà présents, joint avec retour à la ligne
        items = [str(i).strip() for i in val if i]
        return " | ".join(items) if items else fallback
    if isinstance(val, dict):
        parts = []
        for k, v in val.items():
            if v: parts.append(f"{v}")
        return " ".join(parts) if parts else fallback
    return str(val).strip() or fallback

def _risque(r: dict, fallback="N/R") -> str:
    if not r: return fallback
    niveau = r.get("niveau") or r.get("commentaire") and "NA"
    note   = r.get("note") or r.get("commentaire", "")
    if niveau and note:
        return f"{niveau} — {note}"
    return niveau or note or fallback

def _budget(b: dict, fallback="N/R") -> str:
    if not b: return fallback
    if b.get("montant") and b.get("devise"):
        return f"{b['montant']} {b['devise']}"
    return b.get("brut") or b.get("texte_brut") or fallback

# ── Mapping JSON → Placeholders ───────────────────────────────────────────────

def build_map(j: dict) -> dict:
    ig   = j.get("informations_generales", {})
    fin  = j.get("financement", {})
    conc = j.get("concurrence", {})
    hm   = j.get("hommes_mois_budget", {})
    del_ = j.get("delais", {})
    sel  = j.get("criteres_selection", {})
    part = j.get("partenariat", {})
    caut = j.get("caution_soumission", {})
    quest= j.get("demandes_information_client", {})
    vis  = j.get("visite_site_conference", {})
    risk = j.get("risques_non_maitrisables", {})
    dec  = j.get("decision", {})
    wf   = j.get("workflow", {})

    return {
        # Infos générales
        "[[PAYS]]":                      _str(ig.get("pays")),
        "[[INTITULE_OFFRE]]":            _str(ig.get("intitule_offre")),
        "[[NUMERO_REFERENCE]]":          _str(ig.get("numero_reference")),
        "[[CLIENT]]":                    _str(ig.get("client")),
        "[[RESUME_CONTEXTE_OBJECTIFS]]": _str(ig.get("resume_contexte_objectifs")),
        "[[LANGUE]]":                    _str(ig.get("langue")),
        "[[DT_LIM_SOUM]]":              _str(ig.get("date_limite_soumission")),
        "[[DATE_LIMITE_SOUMISSION]]":    _str(ig.get("date_limite_soumission")),

        # Financement
        "[[BAILLEURS]]":                 _str(fin.get("bailleurs")),
        "[[BUDGET_GLOBAL]]":             _budget(fin.get("budget_global", {})),
        "[[FIN_LOCAL_OUI_NON]]":         _str(fin.get("financement_local", {}).get("oui_non")),
        "[[FINA_LOCAL_DETAILS]]":        _str(fin.get("financement_local", {}).get("detail")),

        # Concurrence
        "[[SHORTLIST]]":                 _str(conc.get("shortlist")),
        "[[SHORTLIST_EQUILIBREE]]":      _str(conc.get("shortlist_equilibree")),
        "[[JUSTIF_SHORTLIST]]":          _str(conc.get("justif_shortlist")),
        "[[ANALYSE_CONCURRENCE]]":       _str(conc.get("analyse_concurrence")),

        # Hommes-mois
        "[[HOMMES_MOIS]]":              _str(hm.get("hm_exiges_ou_estimes")),
        "[[BUDGET_INTERNE]]":           _budget(hm.get("budget_interne_estime", {})),
        "[[SOURCE_BUDGET_INTERNE]]":    _str(hm.get("source_budget_interne")),

        # Délais
        "[[DELAI_PREP_SUF]]":           _str(del_.get("delai_preparation_suffisant")),
        "[[JUSTIF_DELAI_PREP]]":        _str(del_.get("justif_delai_preparation")),
        "[[DELAI_GLOBAL_MOIS]]":        _str(del_.get("delai_global_mission_mois")),
        "[[CAPACITE_DELAI]]":           _str(del_.get("capacite_respect_delai")),
        "[[JUSTIF_CAPACITE_DELAI]]":    _str(del_.get("justif_capacite_delai")),

        # Sélection
        "[[MODE_NOTATION]]":            _str(sel.get("mode_notation")),
        "[[NOTE_MINIMALE]]":            _str(sel.get("note_minimale_tech")),
        "[[PON_TECH]]":                 _str(sel.get("ponderation_technique")),
        "[[PON_FIN]]":                  _str(sel.get("ponderation_financiere")),

        # Partenariat
        "[[PARTENAIRES]]":              _str(part.get("partenaires_necessaires")),
        "[[CHEF_DE_FILE]]":             _str(part.get("chef_de_file")),
        "[[ROLES_REPARTITION]]":        _str(part.get("roles_et_repartition")),

        # Caution
        "[[CAUTION_EXIGEE]]":           _str(caut.get("exigee")),
        "[[BANQUE_LOCALE_EXIGEE]]":     _str(caut.get("banque_locale_exigee")),
        "[[CAUTION_MONTANT]]":          _str(caut.get("montant")),
        "[[CAUTION_MONNAIE]]":          _str(caut.get("monnaie")),
        "[[CAUTION_DUREE]]":            _str(caut.get("duree_validite")),

        # Questions
        "[[DATE_LIMITE_QUESTIONS]]":    _str(quest.get("date_limite_questions")),
        "[[LISTE_CLARIFICATIONS]]":     _str(quest.get("liste_clarifications")),

        # Visite
        "[[VISITE_OBL]]":               _str(vis.get("visite_obligatoire")),
        "[[VISITE_DATE]]":              _str(vis.get("visite_date")),
        "[[CONF_OBL]]":                 _str(vis.get("conference_obligatoire")),
        "[[CONF_DATE]]":                _str(vis.get("conference_date")),

        # Risques
        "[[RISQUE_PAYS_SECURITE]]":           _risque(risk.get("risque_pays_securite")),
        "[[RISQUES_FINANCIERS]]":             _risque(risk.get("risques_financiers")),
        "[[PENALITES]]":                      _risque(risk.get("penalites")),
        "[[EXIGENCES_TDR_INACCEPTABLES]]":    _risque(risk.get("exigences_tdr_inacceptables")),
        "[[GARANTIES_ASSURANCES_ELEVEES]]":   _risque(risk.get("garanties_assurances_elevees")),
        "[[TAILLE_DISPERSION]]":              _risque(risk.get("taille_dispersion_projet")),
        "[[FRAIS_DIVERS_ELEVES]]":            _risque(risk.get("frais_divers_eleves")),
        "[[BUDGET_FAIBLE_HM_LIMITES]]":       _risque(risk.get("budget_faible_hm_limites")),
        "[[PARTICIPATION_LOCALE_EXCESSIVE]]": _risque(risk.get("participation_locale_excessive")),
        "[[FISCALITE_NON_MAITRISEE]]":        _risque(risk.get("fiscalite_non_maitrisee")),

        # Décision
        "[[RECOMMANDATION_GO_NOGO]]":   _str(dec.get("recommandation_go_no_go")),
        "[[ARGUMENTAIRE_GO_NOGO]]":     _str(dec.get("argumentaire")),
        "[[POINTS_CRITIQUES]]":         _str(dec.get("points_critiques")),

        # Workflow
        "[[ARRIVEE_BO]]":               _str(wf.get("arrivee_bo")),
        "[[TRANSMISSION]]":             _str(wf.get("transmission_dda")),
        "[[DIRECTION_PILOTE]]":         _str(wf.get("direction_pilote")),
        "[[RESPONSABLE_OFFRE]]":        _str(wf.get("responsable_offre")),

        # Plan action
        "[[PLAN_ACTION]]":              _str(j.get("plan_action")),
    }

# ── Remplacement XML ──────────────────────────────────────────────────────────

def replace_in_xml(xml_path: str, mapping: dict) -> int:
    with open(xml_path, "r", encoding="utf-8") as f:
        content = f.read()

    count = 0
    for placeholder, value in mapping.items():
        if placeholder in content:
            # Escape XML special chars
            safe = (value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace('"', "&quot;"))
            content = content.replace(placeholder, safe)
            count += 1

    with open(xml_path, "w", encoding="utf-8") as f:
        f.write(content)

    return count

# ── Pipeline ─────────────────────────────────────────────────────────────────

from docx import Document
import os
import json

def remplir_template(json_path, template_path, output_docx, output_pdf=None):
    # 1. Charger les données JSON
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"❌ Erreur lecture JSON : {e}")
        return False
    
    # Génération du mapping (utilise ta fonction build_map existante)
    mapping = build_map(data)
    
    # 2. Ouvrir le template Word
    if not os.path.exists(template_path):
        print(f"❌ Erreur : Template introuvable à {template_path}")
        return False
        
    doc = Document(template_path)

    # 3. Remplacement dans les paragraphes simples
    for p in doc.paragraphs:
        for placeholder, value in mapping.items():
            if placeholder in p.text:
                p.text = p.text.replace(placeholder, str(value))

    # 4. Remplacement dans les TABLEAUX (crucial pour ton formulaire APO)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    for placeholder, value in mapping.items():
                        if placeholder in p.text:
                            # On garde le formatage en remplaçant juste le texte
                            p.text = p.text.replace(placeholder, str(value))

    # 5. Sauvegarder le nouveau DOCX
    try:
        doc.save(output_docx)
        print(f"✅ Succès ! DOCX généré : {output_docx}")
        return True
    except Exception as e:
        print(f"❌ Erreur sauvegarde DOCX : {e}")
        return False


# ── Entrée ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # 1. On définit le chemin du dossier actuel (ProjectIQ-PFE)
    # BASE_DIR sera : C:\Users\Rihab\Desktop\ProjectIQ-PFE
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # 2. On crée un dossier "Outputs" local au projet
    OUTPUT_DIR = os.path.join(BASE_DIR, "Outputs")
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 3. Récupération des arguments ou valeurs par défaut
    json_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE_DIR, "Resultats", "apo.json")
    template  = sys.argv[2] if len(sys.argv) > 2 else os.path.join(BASE_DIR, "APO-Formulaire Etudes-Template (1).docx")
    
    # 4. Horodatage pour le nom du fichier
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # 5. --- CHEMINS LOCAUX WINDOWS ---
    output_docx = os.path.join(OUTPUT_DIR, f"APO_Formulaire_{ts}.docx")
    output_pdf  = os.path.join(OUTPUT_DIR, f"APO_Formulaire_{ts}.pdf")

    # 6. Exécution
    print(f"🔄 Génération du formulaire dans : {OUTPUT_DIR}")
    ok = remplir_template(json_path, template, output_docx, output_pdf)
    
    if ok:
        print(f"✅ Succès ! Fichier créé : {os.path.basename(output_docx)}")
    
    sys.exit(0 if ok else 1)