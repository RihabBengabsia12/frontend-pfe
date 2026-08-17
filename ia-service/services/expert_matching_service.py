"""Service pour le matching sémantique des experts via Claude."""

import json
import logging
from models.generation_request import ExpertMatchRequest
from services import claude_client

logger = logging.getLogger(__name__)

def match_experts(req: ExpertMatchRequest) -> list[dict]:
    """
    Interroge Claude pour trouver les experts correspondant au rôle requis.
    Retourne une liste de dicts avec 'expertId' et 'score'.
    """
    system_prompt = claude_client._load_prompt("expert_matching.xml")
    
    # Construction du message utilisateur avec le rôle et la liste d'experts
    user_content = f"""<role_requis>
{req.role_requis}
</role_requis>

<experts_disponibles>
{json.dumps(req.experts_disponibles, ensure_ascii=False, indent=2)}
</experts_disponibles>
"""
    
    try:
        response_json, metrics = claude_client.call_claude_json(system_prompt, user_content, max_tokens=1000)
        
        # Validation basique du retour
        if not isinstance(response_json, list):
            logger.warning(f"Claude n'a pas retourné une liste pour {req.role_requis}: {response_json}")
            return []
            
        return response_json
        
    except Exception as e:
        logger.error(f"Erreur lors du matching expert pour '{req.role_requis}': {e}")
        return []
