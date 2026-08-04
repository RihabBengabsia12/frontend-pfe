"""
Validation post-extraction des champs Phase 1 et Phase 2.
Calculs croisés + génération d'alertes métier.
"""

import re
from datetime import date, datetime
from typing import Optional


DATE_FORMAT = "%d/%m/%Y"
TJM_MIN_EGIS = 450.0
TJM_MAX_EGIS = 3000.0
VISITE_URGENCE_JOURS = 5


# ─────────────────────────────────────────────
# Utilitaires internes
# ─────────────────────────────────────────────

def _parse_date(date_str: Optional[str]) -> Optional[date]:
    if not date_str:
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(date_str.strip(), fmt).date()
        except ValueError:
            continue
    return None


def _parse_budget(budget_str: Optional[str]) -> Optional[float]:
    """Extrait un float depuis une chaîne budget (ex: '2 500 000 €', 'USD 4.2M')."""
    if not budget_str:
        return None
    s = budget_str.upper().replace(" ", "").replace(",", ".")
    # Gestion suffixe M = millions
    multiplier = 1_000_000 if "M" in s else 1
    s = re.sub(r"[^0-9.]", "", s)
    try:
        return float(s) * multiplier
    except ValueError:
        return None


# ─────────────────────────────────────────────
# Fonctions publiques
# ─────────────────────────────────────────────

def validate_date_format(date_str: Optional[str]) -> Optional[str]:
    """Retourne une alerte si la date n'est pas au format JJ/MM/AAAA ou si elle est passée."""
    if not date_str:
        return None
    d = _parse_date(date_str)
    if d is None:
        return f"Format de date invalide : '{date_str}' (attendu JJ/MM/AAAA)"
    if d < date.today():
        return f"Date dépassée : {date_str}"
    return None


def calc_tjm_implicite(
    budget_str: Optional[str],
    hommes_mois: Optional[float],
) -> Optional[float]:
    """
    TJM implicite = BUDGET_HONORAIRES ÷ HOMMES_MOIS ÷ 20 jours/mois.
    Retourne None si les données sont insuffisantes.
    """
    budget = _parse_budget(budget_str)
    if budget is None or not hommes_mois or hommes_mois <= 0:
        return None
    return round(budget / hommes_mois / 20, 2)


def check_tjm_range(tjm: Optional[float]) -> Optional[str]:
    """Alerte si le TJM est hors plage acceptable Egis."""
    if tjm is None:
        return None
    if tjm < TJM_MIN_EGIS:
        return f"TJM implicite {tjm:.0f} €/j — sous le minimum Egis ({TJM_MIN_EGIS:.0f} €/j) → risque budget Rédhibitoire"
    if tjm > TJM_MAX_EGIS:
        return f"TJM implicite {tjm:.0f} €/j — supérieur au maximum plausible ({TJM_MAX_EGIS:.0f} €/j) → vérifier budget"
    return None


def check_visite_urgence(date_str: Optional[str]) -> Optional[str]:
    """Alerte rouge si la visite obligatoire est dans moins de VISITE_URGENCE_JOURS jours."""
    if not date_str:
        return None
    d = _parse_date(date_str)
    if d is None:
        return None
    delta = (d - date.today()).days
    if delta < 0:
        return f"Visite obligatoire PASSÉE le {date_str} — dossier probablement disqualifié"
    if delta <= VISITE_URGENCE_JOURS:
        return f"URGENCE — Visite obligatoire dans {delta} jour(s) ({date_str})"
    return None


def check_date_passe(date_str: Optional[str], label: str = "Date") -> Optional[str]:
    """Alerte générique si une date est passée."""
    if not date_str:
        return None
    d = _parse_date(date_str)
    if d and d < date.today():
        return f"{label} dépassée : {date_str}"
    return None


def validate_ponderation(pon_tech: Optional[float], pon_fin: Optional[float]) -> Optional[str]:
    """Vérifie que pondération technique + financière = 100 %."""
    if pon_tech is None or pon_fin is None:
        return None
    total = pon_tech + pon_fin
    if abs(total - 100.0) > 0.5:
        return f"Pondérations incohérentes : Tech {pon_tech}% + Fin {pon_fin}% = {total}% ≠ 100%"
    return None


def validate_all_p1(champs: dict) -> list[str]:
    """
    Lance toutes les validations Phase 1 et retourne la liste des alertes.
    `champs` est un dict {nom_champ: ChampExtraitIA.valeur}
    """
    alertes: list[str] = []

    def add(msg):
        if msg:
            alertes.append(msg)

    add(validate_date_format(champs.get("DT_LIM_SOUM")))
    add(check_date_passe(champs.get("DT_LIM_SOUM"), "Date limite soumission"))
    add(check_visite_urgence(champs.get("VISITE_DATE")))
    add(check_date_passe(champs.get("CONF_DATE"), "Date conférence préparatoire"))

    tjm = calc_tjm_implicite(champs.get("BUDGET_GLOBAL"), _safe_float(champs.get("HOMMES_MOIS")))
    add(check_tjm_range(tjm))

    if not champs.get("PAYS"):
        alertes.append("PAYS non extrait — champ bloquant absolu")
    if not champs.get("CLIENT"):
        alertes.append("CLIENT non extrait — champ bloquant absolu")
    if not champs.get("BAILLEURS"):
        alertes.append("BAILLEURS non extrait — champ bloquant absolu")

    return alertes


def validate_all_p2(champs: dict) -> list[str]:
    """Lance toutes les validations Phase 2."""
    alertes: list[str] = []

    def add(msg):
        if msg:
            alertes.append(msg)

    add(validate_ponderation(
        _safe_float(champs.get("PON_TECH")),
        _safe_float(champs.get("PON_FIN")),
    ))
    add(check_date_passe(champs.get("DATE_LIMITE_QUESTIONS"), "Date limite questions"))

    return alertes


def _safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        s = str(val).replace(",", ".").strip()
        s = re.sub(r"[^0-9.]", "", s)
        return float(s)
    except (ValueError, TypeError):
        return None