from fastapi import APIRouter, HTTPException, Body
import logging
from pydantic import BaseModel
from typing import Dict
from services.claude_client import list_prompts, update_prompt

logger = logging.getLogger(__name__)

router = APIRouter()

class PromptUpdateReq(BaseModel):
    content: str

@router.get("/prompts")
def get_all_prompts() -> Dict[str, str]:
    """Récupère tous les prompts disponibles."""
    try:
        return list_prompts()
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des prompts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/prompts/{filename}")
def modify_prompt(filename: str, req: PromptUpdateReq):
    """Met à jour le contenu d'un prompt."""
    if not filename.endswith(".txt"):
        filename += ".txt"
        
    try:
        update_prompt(filename, req.content)
        return {"status": "success", "filename": filename}
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour du prompt {filename}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
