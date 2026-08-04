"""
Génération de la checklist des pièces administratives selon le bailleur.
Logique déterministe — pas d'appel Claude nécessaire.
"""

from models.generation_request import ChecklistRequest

_CHECKLISTS: dict[str, list[str]] = {
    "Banque Mondiale": [
        "Formulaire de soumission d'offre signé",
        "Garantie de soumission (caution bancaire)",
        "CV des experts clés avec références vérifiables",
        "Formulaire de déclaration d'éligibilité (Form 1)",
        "Informations sur l'entreprise (Form 2)",
        "Expériences similaires — au moins 3 références",
        "Plan de travail et organigramme de l'équipe",
        "Offre financière sous pli séparé (si Q+P)",
        "Attestations d'inscription professionnelle",
        "Déclaration de conflit d'intérêts",
    ],
    "AFD": [
        "Lettre de soumission signée par représentant légal",
        "Garantie de soumission conforme CPAR",
        "Dossier administratif : Kbis / statuts / pouvoirs",
        "Bilans financiers 3 dernières années",
        "Références similaires (3 minimum, fiches projets)",
        "CV experts clés — format AFD",
        "Méthodologie et plan de travail",
        "Déclaration sur l'honneur non-exclusion",
        "Assurance professionnelle RC en cours de validité",
        "Offre financière détaillée (honoraires + frais)",
    ],
    "UE": [
        "Formulaire de soumission PRAG signé",
        "Déclaration d'éligibilité PRAG",
        "Documents administratifs : certificat légal, TVA",
        "Capacité financière : CA et bilans 3 ans",
        "Capacité technique : références 3 ans",
        "CV experts proposés — format europass recommandé",
        "Organisation et méthodologie",
        "Plan de travail avec chronogramme",
        "Budget détaillé en EUR HT et TTC",
        "Sous-traitance éventuelle — déclaration obligatoire",
    ],
    "Standard": [
        "Lettre de soumission signée",
        "Caution de soumission si requise",
        "Dossier juridique et administratif",
        "Références projets similaires",
        "CV des experts proposés",
        "Méthodologie d'intervention",
        "Plan de travail",
        "Offre financière",
    ],
}


def generate_checklist(req: ChecklistRequest) -> dict:
    """
    Retourne la checklist adaptée au bailleur.
    Matching partiel (ex: 'Banque Mondiale + AFD' → prend BM).
    """
    bailleur_upper = req.bailleur.upper()

    if "BANQUE MONDIALE" in bailleur_upper or "WORLD BANK" in bailleur_upper or "BM" in bailleur_upper:
        key = "Banque Mondiale"
    elif "AFD" in bailleur_upper:
        key = "AFD"
    elif "UE" in bailleur_upper or "UNION EUROPÉENNE" in bailleur_upper or "EUROPEAN UNION" in bailleur_upper:
        key = "UE"
    else:
        key = "Standard"

    return {
        "dossier_id":      req.dossier_id,
        "bailleur_detecte": key,
        "pieces":          _CHECKLISTS[key],
    }