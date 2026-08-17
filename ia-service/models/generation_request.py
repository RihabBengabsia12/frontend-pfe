"""Modèles pour les requêtes de génération de contenu APO, méthodologie, audit."""

from pydantic import BaseModel, Field, AliasChoices
from typing import Optional


class ApoGenerationRequest(BaseModel):
    dossier_id:      str  = Field(..., validation_alias=AliasChoices("dossierId", "dossier_id"))
    intitule_offre:  Optional[str] = Field(None, validation_alias=AliasChoices("intituleOffre", "intitule_offre"))
    client:          Optional[str] = Field(None)
    pays:            Optional[str] = Field(None)
    bailleurs:       Optional[str] = Field(None)
    budget_global:   Optional[str] = Field(None, validation_alias=AliasChoices("budgetGlobal", "budget_global"))
    hommes_mois:     Optional[str] = Field(None, validation_alias=AliasChoices("hommesMois", "hommes_mois"))
    dt_lim_soum:     Optional[str] = Field(None, validation_alias=AliasChoices("dtLimSoum", "dt_lim_soum"))
    langue:          Optional[str] = Field(None)
    pwin_score:      Optional[float] = Field(None, validation_alias=AliasChoices("pwinScore", "pwin_score"))
    decision_auto:   Optional[str] = Field(None, validation_alias=AliasChoices("decisionAuto", "decision_auto"))
    risques:         list[dict] = Field(default_factory=list)
    secteur_ao:      Optional[str] = Field(None, validation_alias=AliasChoices("secteurAo", "secteur_ao"))
    taux_couverture_competences: Optional[float] = Field(None, validation_alias=AliasChoices("tauxCouvertureCompetences", "taux_couverture_competences"))
    taux_couverture_experts: Optional[float] = Field(None, validation_alias=AliasChoices("tauxCouvertureExperts", "taux_couverture_experts"))
    gap_refs:        Optional[str] = Field(None, validation_alias=AliasChoices("gapRefs", "gap_refs"))
    matrice_diff:    Optional[str] = Field(None, validation_alias=AliasChoices("matriceDiff", "matrice_diff"))
    relation_client_niveau: Optional[int] = Field(None, validation_alias=AliasChoices("relationClientNiveau", "relation_client_niveau"))
    delai_global_mois: Optional[str] = Field(None, validation_alias=AliasChoices("delaiGlobalMois", "delai_global_mois"))
    tjm_implicite:   Optional[str] = Field(None, validation_alias=AliasChoices("tjmImplicite", "tjm_implicite"))
    mode_notation:   Optional[str] = Field(None, validation_alias=AliasChoices("modeNotation", "mode_notation"))
    custom_prompts: dict[str, str] = Field(default_factory=dict, description="Prompts spécifiques au dossier")

class MethodologieRequest(ApoGenerationRequest):
    document_text:   Optional[str] = Field(None, validation_alias=AliasChoices("documentText", "document_text"), description="Texte complet du TDR")
    champs_p1:       Optional[dict] = Field(default_factory=dict, validation_alias=AliasChoices("champsP1", "champs_p1"), description="Champs Phase 1 pour le contexte")


class ChecklistRequest(BaseModel):
    dossier_id: str = Field(..., validation_alias=AliasChoices("dossierId", "dossier_id"))
    bailleurs:  Optional[str] = Field(None, description="Banque Mondiale | AFD | UE | Standard | Autre")
    pays:       Optional[str] = Field(None)
    type_contrat: Optional[str] = Field(None, validation_alias=AliasChoices("typeContrat", "type_contrat"))


class MatchingRequest(BaseModel):
    document_text: str = Field(..., validation_alias=AliasChoices("documentText", "document_text"))
    dossier_id:    str = Field(..., validation_alias=AliasChoices("dossierId", "dossier_id"))
    referentiel:   Optional[dict] = Field(default_factory=dict, description="{competences: [], references: [], certifications: []}")
    custom_prompts: dict[str, str] = Field(default_factory=dict, validation_alias=AliasChoices("custom_prompts", "customPrompts"), description="Prompts spécifiques au dossier")


class AuditReportRequest(BaseModel):
    dossier_id:   str = Field(..., validation_alias=AliasChoices("dossierId", "dossier_id"))
    audit_entries: list[dict] = Field(..., validation_alias=AliasChoices("auditTrail", "auditEntries", "audit_entries"), description="Liste des AuditEntry serialisées")
    decision_finale: Optional[str] = Field(None, validation_alias=AliasChoices("decisionFinale", "decision_finale"))
    pwin_score:   Optional[float]  = Field(None, validation_alias=AliasChoices("pwinScore", "pwin_score"))
    intitule_offre: Optional[str] = Field(None, validation_alias=AliasChoices("intituleOffre", "intitule_offre"))
    client: Optional[str] = Field(None)
    nb_champs_corriges_humain: Optional[int] = Field(None, validation_alias=AliasChoices("nbChampsCorrigesHumain", "nb_champs_corriges_humain"))
    a_eu_force_go: Optional[bool] = Field(None, validation_alias=AliasChoices("aEuForceGo", "a_eu_force_go"))
class ExpertMatchRequest(BaseModel):
    role_requis: str = Field(..., validation_alias=AliasChoices("roleRequis", "role_requis"))
    experts_disponibles: list[dict] = Field(..., validation_alias=AliasChoices("expertsDisponibles", "experts_disponibles"))

