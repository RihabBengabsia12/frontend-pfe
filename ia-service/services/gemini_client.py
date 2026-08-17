"""
Client alternatif utilisant Google Gemini (API via google-generativeai).
Sert de fallback quand le quota Claude est épuisé.
"""

import os
import json
import logging
import time

try:
    import google.generativeai as genai
    from google.generativeai.types import HarmCategory, HarmBlockThreshold
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

logger = logging.getLogger(__name__)

# Constantes
GEMINI_MODEL = "gemini-2.0-flash" # Modèle rapide et pas cher, idéal pour du fallback/test
MAX_RETRIES = 2
RETRY_DELAY_SEC = 2.0

_gemini_configured = False

def _ensure_configured():
    global _gemini_configured
    if not _gemini_configured:
        if not GEMINI_AVAILABLE:
            raise ImportError("Le module google-generativeai n'est pas installé. Lancez 'pip install google-generativeai'.")
        
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key or api_key == "votre_cle_gemini":
            raise EnvironmentError("GEMINI_API_KEY non définie ou invalide dans .env")
        
        genai.configure(api_key=api_key)
        _gemini_configured = True
        logger.info("Client Google Gemini configuré avec succès.")

def call_gemini(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 8192,
    document_text: str = None,
    json_mode: bool = False
) -> tuple[str, dict]:
    """
    Appelle l'API Gemini.
    Imite la signature et le format de retour de call_claude pour être un drop-in replacement.
    """
    _ensure_configured()
    
    # 1. Préparation du contenu
    prompt_parts = []
    if document_text:
        prompt_parts.append(f"<document>\n{document_text}\n</document>")
    prompt_parts.append(user_prompt)
    
    final_prompt = "\n\n".join(prompt_parts)
    
    # 2. Configuration du modèle
    generation_config = {
        "temperature": 0.2, # Température basse pour extraction précise
    }
    
    if json_mode:
        generation_config["response_mime_type"] = "application/json"
        
    model = genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        system_instruction=system_prompt,
        generation_config=generation_config,
        safety_settings={
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
        }
    )
    
    # 3. Appel API avec retry
    for attempt in range(1, MAX_RETRIES + 2):
        try:
            start_time = time.time()
            
            response = model.generate_content(final_prompt)
            
            end_time = time.time()
            
            if response.prompt_feedback and response.prompt_feedback.block_reason:
                raise ValueError(f"Requête bloquée par Gemini: {response.prompt_feedback.block_reason}")
                
            text_response = response.text
            
            # 4. Simulation des métriques
            in_chars = len(system_prompt) + len(final_prompt)
            out_chars = len(text_response)
            
            in_tokens = in_chars // 4
            out_tokens = out_chars // 4
            
            total_cost = (in_tokens * 0.35 / 1_000_000) + (out_tokens * 1.05 / 1_000_000)
            
            metrics = {
                "token_usage":            in_tokens + out_tokens,
                "processing_time_ms":     int((end_time - start_time) * 1000),
                "estimated_cost":         total_cost,
                "input_tokens":           in_tokens,
                "output_tokens":          out_tokens,
                "cache_creation_tokens":  0,
                "cache_read_tokens":      0,
                "cache_hit":              False,
                "provider":               "gemini"
            }
            
            return text_response, metrics
            
        except Exception as e:
            logger.warning("Erreur Gemini (essai %d/%d): %s", attempt, MAX_RETRIES + 1, e)
            if attempt > MAX_RETRIES:
                logger.error("Échec définitif Gemini: %s", e)
                raise RuntimeError(f"Gemini a échoué après {MAX_RETRIES + 1} tentatives") from e
            
            time.sleep(RETRY_DELAY_SEC * attempt)

def call_gemini_json(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 8192,
    document_text: str = None
) -> tuple[dict, dict]:
    """
    Appelle Gemini et parse le JSON.
    """
    for attempt in range(1, MAX_RETRIES + 2):
        raw, metrics = call_gemini(system_prompt, user_prompt, max_tokens, document_text, json_mode=True)
        cleaned = raw.strip()
        
        first_brace = cleaned.find('{')
        last_brace = cleaned.rfind('}')
        first_bracket = cleaned.find('[')
        last_bracket = cleaned.rfind(']')
        
        start_idx = -1
        end_idx = -1
        
        if first_brace != -1 and (first_bracket == -1 or first_brace < first_bracket):
            start_idx = first_brace
            end_idx = last_brace
        elif first_bracket != -1:
            start_idx = first_bracket
            end_idx = last_bracket
            
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            cleaned = cleaned[start_idx:end_idx+1]
            
        try:
            return json.loads(cleaned), metrics
        except json.JSONDecodeError as e:
            logger.error("Réponse Gemini non-JSON (essai %d): %s", attempt, e)
            if attempt > MAX_RETRIES:
                raise ValueError(f"Gemini n'a pas retourné du JSON valide: {e}") from e
            time.sleep(RETRY_DELAY_SEC)
