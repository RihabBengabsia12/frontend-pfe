from fastapi import APIRouter, HTTPException, Header
import logging
import os
from pydantic import BaseModel
from typing import Dict
from services.claude_client import list_prompts, update_prompt

logger = logging.getLogger(__name__)

router = APIRouter()

class PromptUpdateReq(BaseModel):
    content: str


def require_config_api_key(x_config_api_key: str | None = Header(default=None)) -> None:
    """Protège la lecture et la modification des prompts en environnement déployé."""
    expected_key = os.getenv("PROJECTIQ_CONFIG_API_KEY")
    if not expected_key:
        raise HTTPException(status_code=503, detail="Configuration des prompts désactivée : PROJECTIQ_CONFIG_API_KEY absent")
    if x_config_api_key != expected_key:
        raise HTTPException(status_code=403, detail="Accès non autorisé à la configuration des prompts")

@router.get("/prompts")
def get_all_prompts(x_config_api_key: str | None = Header(default=None)) -> Dict[str, str]:
    """Récupère tous les prompts disponibles."""
    try:
        require_config_api_key(x_config_api_key)
        return list_prompts()
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des prompts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/prompts/{filename}")
def modify_prompt(filename: str, req: PromptUpdateReq, x_config_api_key: str | None = Header(default=None)):
    """Met à jour le contenu d'un prompt."""
    if not filename.endswith(".txt"):
        filename += ".txt"
        
    try:
        require_config_api_key(x_config_api_key)
        update_prompt(filename, req.content)
        return {"status": "success", "filename": filename}
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour du prompt {filename}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
