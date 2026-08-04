"""Modèles de requête pour les endpoints d'extraction."""

from pydantic import BaseModel, Field, AliasChoices
from typing import Optional


class ExtractionRequest(BaseModel):
    document_text: str = Field(..., validation_alias=AliasChoices("documentText", "document_text"), description="Texte brut extrait du PDF/DOCX")
    dossier_id: str    = Field(..., validation_alias=AliasChoices("dossierId", "dossier_id"), description="UUID du dossier")
    phase: str         = Field("P1", validation_alias=AliasChoices("phase", "Phase"), description="Phase d'extraction (P1, P2, etc.)")
    custom_prompts: dict[str, str] = Field(default_factory=dict, validation_alias=AliasChoices("custom_prompts", "customPrompts"), description="Prompts spécifiques au dossier")

class ReextractFieldRequest(BaseModel):
    document_text: str = Field(..., alias="documentText", description="Texte brut du document")
    field_name: str    = Field(..., alias="fieldName", description="Nom du champ à ré-extraire (ex: BUDGET_GLOBAL)")
    dossier_id: str    = Field(..., alias="dossierId")
    custom_prompts: dict[str, str] = Field(default_factory=dict, description="Prompts spécifiques au dossier")

class RiskAnalysisRequest(BaseModel):
    document_text: str = Field(..., alias="documentText")
    dossier_id: str    = Field(..., alias="dossierId")
    tjm_implicite: Optional[float] = Field(None, description="TJM calculé — aide la détection du risque budget")
    custom_prompts: dict[str, str] = Field(default_factory=dict, description="Prompts spécifiques au dossier")

class NoGoReportRequest(BaseModel):
    dossier_id: str
    pwin_score: float
    score_a_faisabilite: float
    score_b_rentabilite: float
    score_c_risques: float
    score_d_concurrence: float
    score_e_conformite: float
    risques_redhibitoires: list[str] = Field(default_factory=list)
    champs_principaux: dict          = Field(default_factory=dict,
        description="Dict des champs clés: PAYS, CLIENT, BUDGET, HM, TJM_IMPLICITE…")
    custom_prompts: dict[str, str] = Field(default_factory=dict, description="Prompts spécifiques au dossier")