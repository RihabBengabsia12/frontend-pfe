"""Modèles pour les requêtes de génération de contenu APO, méthodologie, audit."""

from pydantic import BaseModel, Field
from typing import Optional


class ApoGenerationRequest(BaseModel):
    dossier_id:      str
    champs_p1_p2_p3: dict = Field(..., description="Tous les champs extraits des phases 1, 2 et 3")
    pwin_score:      dict = Field(..., description="{score_global, axe_A…axe_E, decision_auto}")
    matching_result: dict = Field(default_factory=dict)
    custom_prompts: dict[str, str] = Field(default_factory=dict, description="Prompts spécifiques au dossier")


class MethodologieRequest(BaseModel):
    dossier_id:      str
    document_text:   str  = Field(..., description="Texte complet du TDR")
    matching_result: dict = Field(default_factory=dict)
    matrice_diff:    list = Field(default_factory=list, description="Matrice différenciation [{critere, position, argument}]")
    champs_p1:       dict = Field(default_factory=dict, description="Champs Phase 1 pour le contexte")
    custom_prompts: dict[str, str] = Field(default_factory=dict, description="Prompts spécifiques au dossier")


class ChecklistRequest(BaseModel):
    dossier_id: str
    bailleur:   str = Field(..., description="Banque Mondiale | AFD | UE | Standard | Autre")


class MatchingRequest(BaseModel):
    document_text: str
    dossier_id:    str
    referentiel:   dict = Field(..., description="{competences: [], references: [], certifications: []}")
    custom_prompts: dict[str, str] = Field(default_factory=dict, description="Prompts spécifiques au dossier")


class AuditReportRequest(BaseModel):
    dossier_id:   str
    audit_entries: list[dict] = Field(..., description="Liste des AuditEntry serialisées")
    decision_finale: Optional[str] = None
    pwin_score:   Optional[float]  = None