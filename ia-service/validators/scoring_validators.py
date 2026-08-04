"""
Validation des données de scoring avant calcul P-Win.
Détecte les incohérences et les niveaux Rédhibitoires.
"""

NIVEAUX_VALIDES = {"Faible", "Modéré", "Élevé", "Rédhibitoire"}

RISQUES_CLES = [
    "risque_pays_securite",
    "risques_financiers",
    "penalites",
    "exigences_tdr_inacceptables",
    "garanties_assurances_elevees",
    "taille_dispersion",
    "frais_divers_eleves",
    "budget_faible_hm_limites",
    "participation_locale_excessive",
    "fiscalite_non_maitrisee",
]


def validate_risk_levels(risques: dict) -> list[str]:
    """
    Vérifie que chaque niveau de risque appartient aux valeurs autorisées.
    Retourne la liste des erreurs de validation.
    """
    erreurs: list[str] = []
    for cle, val in risques.items():
        niveau = val if isinstance(val, str) else val.get("niveau", "")
        if niveau not in NIVEAUX_VALIDES:
            erreurs.append(f"Niveau de risque invalide pour '{cle}': '{niveau}' — valeurs autorisées: {NIVEAUX_VALIDES}")
    return erreurs


def detect_redhibitoires(risques: dict) -> list[str]:
    """
    Retourne la liste des noms de risques évalués Rédhibitoire.
    Un seul Rédhibitoire suffit à forcer P-Win = 0.
    """
    redhibitoires = []
    for cle, val in risques.items():
        niveau = val if isinstance(val, str) else val.get("niveau", "")
        if niveau == "Rédhibitoire":
            redhibitoires.append(cle)
    return redhibitoires


def validate_scoring_config(config: dict) -> list[str]:
    """Valide la cohérence d'une ScoringConfig reçue en entrée."""
    erreurs: list[str] = []
    poids_keys = ["poids_a", "poids_b", "poids_c", "poids_d", "poids_e"]
    poids_total = sum(config.get(k, 0.0) for k in poids_keys)
    if abs(poids_total - 1.0) > 0.01:
        erreurs.append(f"La somme des poids P-Win doit être 1.0 — actuel: {poids_total:.3f}")
    seuil_nogo = config.get("seuil_nogo", 0.20)
    seuil_go   = config.get("seuil_go_conditionnel", 0.40)
    if seuil_nogo >= seuil_go:
        erreurs.append("seuil_nogo doit être < seuil_go_conditionnel")
    return erreurs