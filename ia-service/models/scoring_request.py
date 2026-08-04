"""Modèles pour les requêtes scoring (non utilisés directement par Claude — scoring côté Java).
   Conservés pour validation entrante et documentation."""

from pydantic import BaseModel, Field
from typing import Optional


class ScoringValidationRequest(BaseModel):
    """Validation des valeurs de scoring avant calcul."""
    dossier_id: str
    tjm_implicite: Optional[float] = None
    risque_pays_securite:          str = "Faible"
    risques_financiers:            str = "Faible"
    penalites:                     str = "Faible"
    exigences_tdr_inacceptables:   str = "Faible"
    garanties_assurances_elevees:  str = "Faible"
    taille_dispersion:             str = "Faible"
    frais_divers_eleves:           str = "Faible"
    budget_faible_hm_limites:      str = "Faible"
    participation_locale_excessive:str = "Faible"
    fiscalite_non_maitrisee:       str = "Faible"