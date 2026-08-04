"""
TenderBolt — Extraction TDR / Ollama Chunking
100% local, gratuit, optimisé pour gros dossiers
"""

import os
import sys
import json
import time
import logging
import requests
from pathlib import Path

logging.basicConfig(level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("TenderBolt.OllamaChunk")

# ==================== CONFIGURATION ====================
OLLAMA_URL    = "http://localhost:11434/v1/chat/completions"
MODELE_OLLAMA = "qwen2.5:3b"
CHUNK_PAGES   = 4       # pages par chunk
MAX_CHARS_CHUNK = 6000  # max caractères par chunk

# ==================== PROMPT PROFESSIONNEL ====================
PROMPT_CHUNK = """
Tu es un assistant expert en extraction de données de documents officiels (TDR, contrats, programmes). 
Remplis un JSON complet selon le schéma fourni. Si l’information est manquante, mets null ou liste vide.

Champs à extraire :
{
  "type_document": "",
  "est_template": false,
  "reference": "",
  "titre_document": "",
  "acronyme_mission": "",
  "langue": "",
  "date_publication": "",
  "date_limite_soumission": "",
  "nb_pages": null,
  "nb_lots": null,
  "pays": "",
  "region": "",
  "ville": "",
  "zone_intervention": [],
  "pouvoir_adjudicateur": {
    "organisation": "",
    "acronyme": "",
    "structure": "",
    "acronyme_structure": "",
    "adresse": "",
    "telephone": "",
    "email": "",
    "site_web": "",
    "contact_nom": ""
  },
  "bailleur": [],
  "type_financement": [],
  "programme_cadre": "",
  "contrat_cadre": "",
  "beneficiaire": {
    "organisation": "",
    "acronyme": "",
    "direction": "",
    "acronyme_direction": "",
    "pays": ""
  },
  "programmes_connexes": [],
  "secteurs": [],
  "mots_cles": [],
  "acronymes": {},
  "objectif_general": "",
  "objectifs_specifiques": [],
  "duree_mois": null,
  "duree_jours": null,
  "date_debut_prevue": "",
  "date_fin_prevue": "",
  "nb_experts": null,
  "total_hommes_jours": null,
  "experts": [],
  "lots": [],
  "composantes": [],
  "produits_attendus": [],
  "livrables": [],
  "rapports": [],
  "budget_total": null,
  "devise": "",
  "avance_pct": null,
  "garantie_soumission_pct": null,
  "penalites_retard": null,
  "modalites_paiement": "",
  "validite_offre_jours": null,
  "type_evaluation": "",
  "poids_technique_pct": null,
  "poids_financier_pct": null,
  "criteres_evaluation": [],
  "qualification_requise": [],
  "documents_requis": [],
  "logistique": {
    "lieu_principal": "",
    "deplacements": "",
    "bureaux": "",
    "equipement": "",
    "formation_requise": ""
  },
  "gestion_projet": {
    "organe_responsable": "",
    "supervision": "",
    "comite_suivi": "",
    "reunions": ""
  },
  "risques": [],
  "hypotheses": [],
  "confiance_extraction": "",
  "taux_remplissage_pct": null,
  "champs_non_trouves": [],
  "incoherences": [],
  "notes_extracteur": ""
}

Instructions :
1. Extraire toutes les sections du document.
2. Dates au format DD/MM/YYYY.
3. Listes vides si aucune info.
4. "confiance_extraction" : faible / moyenne / élevée.
5. "taux_remplissage_pct" : proportion de champs remplis.
6. "notes_extracteur" : sections ambiguës ou manquantes.
7. Retourner uniquement JSON valide.
"""

# ==================== SCHEMA JSON ====================
SCHEMA_JSON = {
    "type_document": None, "est_template": None, "reference": None,
    "titre_document": None, "acronyme_mission": None, "langue": None,
    "date_publication": None, "date_limite_soumission": None, "nb_pages": None,
    "pays": None, "ville": None, "zone_intervention": [],
    "pouvoir_adjudicateur": {
        "organisation": None, "acronyme": None,
        "structure": None, "acronyme_structure": None
    },
    "bailleur": None, "type_financement": None, "programme_cadre": None,
    "beneficiaire": {
        "organisation": None, "acronyme": None,
        "direction": None, "acronyme_direction": None
    },
    "secteurs": [], "mots_cles": [], "acronymes": {},
    "objectif_general": None, "objectifs_specifiques": [],
    "duree_mois": None, "duree_jours": None,
    "date_debut_prevue": None, "date_fin_prevue": None,
    "nb_experts": None, "total_hommes_jours": None,
    "experts": [], "composantes": [], "rapports": [],
    "produits_attendus": [], "livrables": [],
    "budget_total": None, "devise": None,
    "garantie_soumission_pct": None, "penalites_retard": None,
    "logistique": {"lieu_principal": None, "deplacements": None},
    "gestion_projet": {"organe_responsable": None, "supervision": None},
    "risques": [], "hypotheses": [],
    "confiance_extraction": None, "taux_remplissage_pct": None,
    "notes_extracteur": None
}
# ==================== LECTURE CHUNKS ====================
def lire_chunks(chemin: str) -> list:
    ext = Path(chemin).suffix.lower()
    chunks = []

    if ext == ".pdf":
        import fitz
        doc = fitz.open(chemin)
        nb_pages = len(doc)
        logger.info("PDF : %d pages — chunks de %d pages", nb_pages, CHUNK_PAGES)
        for i in range(0, nb_pages, CHUNK_PAGES):
            texte_chunk = ""
            for j in range(i, min(i + CHUNK_PAGES, nb_pages)):
                texte_chunk += doc[j].get_text() + "\n"
            if texte_chunk.strip():
                chunks.append(texte_chunk[:MAX_CHARS_CHUNK])
        doc.close()

    elif ext in (".docx", ".doc"):
        from docx import Document
        doc = Document(chemin)
        paragraphes = [p.text for p in doc.paragraphs if p.text.strip()]
        logger.info("DOCX : %d paragraphes", len(paragraphes))
        for i in range(0, len(paragraphes), 40):
            texte_chunk = "\n".join(paragraphes[i:i+40])
            if texte_chunk.strip():
                chunks.append(texte_chunk[:MAX_CHARS_CHUNK])
    else:
        raise ValueError("Format non supporté : " + ext)

    logger.info("%d chunks générés", len(chunks))
    return chunks

# ==================== EXTRACTION PAR CHUNK ====================
def extraire_chunk(texte: str, numero: int, total: int) -> dict:
    prompt = PROMPT_CHUNK + "\n\nDOCUMENT (chunk " + str(numero) + "/" + str(total) + "):\n" + texte
    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model"   : MODELE_OLLAMA,
                "messages": [
                    {"role": "system", "content": "Retourne UNIQUEMENT du JSON valide."},
                    {"role": "user",   "content": prompt}
                ],
                "max_tokens" : 3000,
                "temperature": 0.0
            },
            timeout = 600
        )
        contenu = response.json()["choices"][0]["message"]["content"]
        # Nettoyage code block
        t = contenu.strip()
        if t.startswith("```json"): t = t[7:]
        elif t.startswith("```"):   t = t[3:]
        if t.endswith("```"):       t = t[:-3]
        return json.loads(t.strip())
    except Exception as e:
        logger.error("Chunk %d — Erreur : %s", numero, str(e))
        return {}

# ==================== FUSION CHUNKS ====================
def fusionner_chunks(chunks_json: list) -> dict:
    resultat = {k: None for k in SCHEMA_JSON}
    for k, v in SCHEMA_JSON.items():
        if isinstance(v, list):
            resultat[k] = []
        elif isinstance(v, dict):
            resultat[k] = {sk: None for sk in v}
    for chunk in chunks_json:
        for cle, valeur in chunk.items():
            if cle not in resultat: continue
            if not valeur or valeur in ["", [], {}]: continue
            if isinstance(valeur, list):
                existants = resultat.get(cle, []) or []
                for item in valeur:
                    if item not in existants:
                        existants.append(item)
                resultat[cle] = existants
            elif isinstance(valeur, dict):
                existant = resultat.get(cle, {}) or {}
                for sk, sv in valeur.items():
                    if sv and not existant.get(sk):
                        existant[sk] = sv
                resultat[cle] = existant
            else:
                if not resultat.get(cle):
                    resultat[cle] = valeur
    return resultat

# ==================== CALCUL QUALITE ====================
def calculer_qualite(j: dict) -> dict:
    def compter(d):
        total, remplis = 0, 0
        for v in d.values():
            if isinstance(v, dict):
                t2, r2 = compter(v)
                total += t2; remplis += r2
            else:
                total += 1
                if v not in [None, [], {}]: remplis += 1
        return total, remplis
    total, remplis = compter(j)
    taux = round(remplis / total * 100) if total > 0 else 0
    j["taux_remplissage_pct"] = taux
    j["confiance_extraction"] = "haute" if taux > 85 else "moyenne" if taux > 60 else "faible"
    return j

# ==================== PIPELINE PRINCIPAL ====================
def pipeline_ollama_chunked(chemin: str):
    print("\n" + "="*60)
    print("  OLLAMA CHUNKED — Qwen2.5:3b local gratuit")
    print("="*60)
    print(f"  Fichier : {chemin}")
    t0 = time.time()
    chunks = lire_chunks(chemin)
    print(f"  Chunks : {len(chunks)} — Temps estimé : ~{len(chunks)*5} min")
    chunks_json = []
    for i, chunk in enumerate(chunks, 1):
        print(f"\n  Chunk {i}/{len(chunks)} ({len(chunk)} chars)...")
        t_start = time.time()
        cj = extraire_chunk(chunk, i, len(chunks))
        chunks_json.append(cj)
        print(f"  OK — {round(time.time()-t_start,2)}s — Champs trouvés : {sum(1 for v in cj.values() if v)}")
    print("\n  Fusion des chunks...")
    json_final = fusionner_chunks(chunks_json)
    json_final = calculer_qualite(json_final)
    temps_total = round(time.time()-t0,2)
    print("\n" + "="*60)
    print(f"  Taux remplissage : {json_final.get('taux_remplissage_pct')}%")
    print(f"  Confiance        : {json_final.get('confiance_extraction')}")
    print(f"  Chunks traités   : {len(chunks_json)}/{len(chunks)}")
    print(f"  Temps total      : {temps_total:.2f}s")
    print(f"  Cout             : 0.0000 USD (100% local gratuit)")
    print("="*60)
    with open("ollama_chunked_resultat.json","w",encoding="utf-8") as f:
        json.dump(json_final,f,ensure_ascii=False,indent=2)
    print("  JSON sauvegardé : ollama_chunked_resultat.json")
    return json_final

# ==================== EXECUTION ====================
if __name__ == "__main__":
    chemin = sys.argv[1] if len(sys.argv)>1 else "DPs/TDR.pdf"
    pipeline_ollama_chunked(chemin)