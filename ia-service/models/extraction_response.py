"""Modèles de réponse pour les endpoints d'extraction et d'analyse de risques."""

from pydantic import BaseModel, Field
from typing import Optional


class ChampExtraitIA(BaseModel):
    valeur:    Optional[str] = None
    confiance: float         = Field(0.0, ge=0.0, le=1.0)
    source:    str           = Field("", description="Extrait verbatim du document ayant servi à l'extraction")


class ExtractionResponse(BaseModel):
    dossier_id: str
    champs:     dict[str, ChampExtraitIA] = Field(default_factory=dict)
    alertes:    list[str]                 = Field(default_factory=list)
    token_usage: int                      = Field(0, description="Tokens consommés (input+output)")
    processing_time_ms: int               = Field(0, description="Temps d'exécution en millisecondes")
    estimated_cost: float                 = Field(0.0, description="Coût estimé en USD")
    cache_creation_tokens: int            = Field(0, description="Tokens mis en cache (Write)")
    cache_read_tokens: int                = Field(0, description="Tokens lus depuis le cache (Read)")


class RiskResult(BaseModel):
    niveau:        str  # Faible | Modéré | Élevé | Rédhibitoire
    justification: str


class RiskAnalysisResponse(BaseModel):
    dossier_id: str
    risques:    dict[str, RiskResult] = Field(default_factory=dict)
    alerte_redhibitoire: bool         = False
    risques_redhibitoires: list[str]  = Field(default_factory=list)
    token_usage: int                  = Field(0, description="Tokens consommés (input+output)")
    processing_time_ms: int           = Field(0, description="Temps d'exécution en millisecondes")
    estimated_cost: float             = Field(0.0, description="Coût estimé en USD")
    cache_creation_tokens: int        = Field(0, description="Tokens mis en cache (Write)")
    cache_read_tokens: int            = Field(0, description="Tokens lus depuis le cache (Read)")