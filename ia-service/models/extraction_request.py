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
    dossier_id: str = Field(..., alias="dossierId")
    pwin_score: float = Field(..., alias="pwinScore")
    score_a_faisabilite: float = Field(..., alias="scoreA")
    score_b_rentabilite: float = Field(..., alias="scoreB")
    score_c_risques: float = Field(..., alias="scoreC")
    score_d_concurrence: float = Field(..., alias="scoreD")
    score_e_conformite: float = Field(..., alias="scoreE")
    
    decisionAuto: Optional[str] = None
    motifPrincipal: Optional[str] = None
    risques: list[dict] = Field(default_factory=list)
    intituleOffre: Optional[str] = None
    client: Optional[str] = None
    pays: Optional[str] = None
    
    custom_prompts: dict[str, str] = Field(default_factory=dict, description="Prompts spécifiques au dossier")

    @property
    def risques_redhibitoires(self) -> list[str]:
        # Extract 'nom' or 'justification' from the dict
        return [r.get('nom', 'Inconnu') for r in self.risques if isinstance(r, dict)]

    @property
    def champs_principaux(self) -> dict:
        return {
            "INTITULÉ OFFRE": self.intituleOffre or "N/A",
            "CLIENT": self.client or "N/A",
            "PAYS": self.pays or "N/A",
            "MOTIF PRINCIPAL": self.motifPrincipal or "N/A"
        }