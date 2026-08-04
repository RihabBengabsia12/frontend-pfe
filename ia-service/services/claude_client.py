"""
Wrapper singleton autour de l'API Anthropic.
Toute invocation Claude dans ia-service passe par cette classe.

Stratégie de Prompt Caching (Anthropic ephemeral cache, TTL = 5 min) :
  1. System prompt  → mis en cache (liste avec cache_control)
     Économie : 90% du coût input sur le 2ème appel et suivants avec le même prompt.
  2. Document (TDR) → mis en cache (cache_control sur le bloc message)
     Économie : le TDR est partagé entre P1, P2, Risques, Matching du même dossier.
  ⚠ Minimum 1024 tokens pour qu'Anthropic active le cache.
"""

import os
import json
import logging
import time
from pathlib import Path

import anthropic
import httpx

logger = logging.getLogger(__name__)

# ─── Cache mémoire des fichiers de prompt (lecture disque unique) ────────────
_PROMPT_CACHE: dict[str, str] = {}

# ─── Constantes ─────────────────────────────────────────────────────────────
CLAUDE_MODEL    = "claude-sonnet-4-6"
MAX_TOKENS      = 4096
MAX_RETRIES     = 2
RETRY_DELAY_SEC = 2.0

# ─── Client Anthropic Singleton (instancié une seule fois) ──────────────────
_anthropic_client: anthropic.Anthropic | None = None

def _get_client() -> anthropic.Anthropic:
    """
    Retourne le client Anthropic singleton.
    Créé à la première utilisation avec le header beta prompt-caching.
    """
    global _anthropic_client
    if _anthropic_client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise EnvironmentError("ANTHROPIC_API_KEY non définie")
        _anthropic_client = anthropic.Anthropic(
            api_key=api_key,
            default_headers={"anthropic-beta": "prompt-caching-2024-07-31"}
        )
        logger.info("Client Anthropic singleton initialisé avec prompt caching activé.")
    return _anthropic_client


def _load_prompt(filename: str) -> str:
    """Charge un fichier de prompt depuis prompts/ avec mise en cache mémoire."""
    if filename not in _PROMPT_CACHE:
        path = Path(__file__).parent.parent / "prompts" / filename
        _PROMPT_CACHE[filename] = path.read_text(encoding="utf-8")
    return _PROMPT_CACHE[filename]


def call_claude(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = MAX_TOKENS,
    document_text: str = None
) -> tuple[str, dict]:
    """
    Appelle l'API Anthropic avec prompt caching complet :
      - system_prompt → mis en cache via liste de blocs avec cache_control
      - document_text → mis en cache dans le message utilisateur

    Retourne (texte_brut, métriques_audit).
    """
    client = _get_client()

    # ── 1. System prompt — format liste avec cache_control ──────────────────
    # Anthropic exige un tableau de blocs (pas un string simple) pour cacher.
    # Le cache_control sur le DERNIER bloc du système active le cache pour
    # TOUS les blocs système qui précèdent.
    system_blocks = [
        {
            "type": "text",
            "text": system_prompt,
            "cache_control": {"type": "ephemeral"}
        }
    ]

    # ── 2. Message utilisateur — document caché + instruction non cachée ─────
    # Le document TDR est le même sur tous les appels d'un dossier (P1, P2,
    # Risques…). Le mettre en cache = économie de 90% dès le 2ème appel.
    # L'instruction utilisateur (user_prompt) n'est PAS cachée car elle
    # change à chaque appel.
    messages_content = []
    if document_text:
        messages_content.append({
            "type": "text",
            "text": f"<document>\n{document_text}\n</document>",
            "cache_control": {"type": "ephemeral"}   # ← TDR mis en cache
        })
    messages_content.append({
        "type": "text",
        "text": user_prompt                           # ← instruction, non cachée
    })

    # ── 3. Appel API avec retry ──────────────────────────────────────────────
    for attempt in range(1, MAX_RETRIES + 2):
        try:
            start_time = time.time()

            response = client.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=max_tokens,
                system=system_blocks,               # ← liste, pas string simple
                messages=[{"role": "user", "content": messages_content}],
            )

            end_time = time.time()

            # ── 4. Extraction des métriques de cache Anthropic ───────────────
            in_tokens       = response.usage.input_tokens
            out_tokens      = response.usage.output_tokens
            cache_creation  = getattr(response.usage, "cache_creation_input_tokens", 0) or 0
            cache_read      = getattr(response.usage, "cache_read_input_tokens", 0) or 0

            # Log lisible pour déboguer le cache en dev
            if cache_creation > 0:
                logger.debug("Cache WRITE : %d tokens créés", cache_creation)
            if cache_read > 0:
                logger.debug("Cache READ  : %d tokens lus (économie 90%%)", cache_read)

            # ── 5. Calcul du coût estimé (tarif Claude Sonnet 4) ─────────────
            # Tarification : Input $3/1M | Output $15/1M
            #                Cache Write $3.75/1M | Cache Read $0.30/1M
            base_in_cost       = in_tokens      * 3.00  / 1_000_000
            cache_write_cost   = cache_creation * 3.75  / 1_000_000
            cache_read_cost    = cache_read     * 0.30  / 1_000_000
            out_cost           = out_tokens     * 15.00 / 1_000_000
            total_cost         = base_in_cost + cache_write_cost + cache_read_cost + out_cost

            metrics = {
                "token_usage":            in_tokens + out_tokens + cache_creation + cache_read,
                "processing_time_ms":     int((end_time - start_time) * 1000),
                "estimated_cost":         total_cost,
                "input_tokens":           in_tokens,
                "output_tokens":          out_tokens,
                "cache_creation_tokens":  cache_creation,
                "cache_read_tokens":      cache_read,
                # Indicateur pratique : True si le cache a économisé des tokens
                "cache_hit":              cache_read > 0,
            }

            return response.content[0].text, metrics

        except anthropic.RateLimitError as e:
            logger.warning("Rate limit (essai %d/%d): %s", attempt, MAX_RETRIES + 1, e)
        except anthropic.APIConnectionError as e:
            logger.warning("Erreur réseau (essai %d/%d): %s", attempt, MAX_RETRIES + 1, e)
        except Exception as e:
            logger.error("Erreur inattendue Claude: %s", e)
            raise

        if attempt <= MAX_RETRIES:
            time.sleep(RETRY_DELAY_SEC * attempt)

    raise RuntimeError(f"Tous les essais Claude ont échoué après {MAX_RETRIES + 1} tentatives")


def call_claude_json(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = MAX_TOKENS,
    document_text: str = None
) -> tuple[dict, dict]:
    """
    Variante qui parse automatiquement la réponse JSON.
    Retourne (parsed_json, metrics).
    Nettoie les éventuelles balises Markdown que Claude pourrait ajouter malgré les instructions.
    """
    raw, metrics = call_claude(system_prompt, user_prompt, max_tokens, document_text)
    cleaned = raw.strip()

    # Nettoyage des balises Markdown si Claude en génère malgré les instructions
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        # Retire la première ligne (```json ou ```) et la dernière (```)
        inner_lines = lines[1:]
        if inner_lines and inner_lines[-1].strip() == "```":
            inner_lines = inner_lines[:-1]
        cleaned = "\n".join(inner_lines)

    try:
        return json.loads(cleaned), metrics
    except json.JSONDecodeError as e:
        logger.error("Réponse Claude non-JSON: %s\n---\n%s", e, cleaned[:500])
        raise ValueError(f"Claude n'a pas retourné du JSON valide: {e}") from e


# ─── Fonctions utilitaires publiques ────────────────────────────────────────

def load_prompt(filename: str) -> str:
    """API publique pour charger un prompt depuis n'importe quel service."""
    return _load_prompt(filename)


def list_prompts() -> dict[str, str]:
    """Retourne la liste complète de tous les prompts (nom_fichier: contenu)."""
    prompts_dir = Path(__file__).parent.parent / "prompts"
    all_prompts = {}
    if prompts_dir.exists() and prompts_dir.is_dir():
        for p in prompts_dir.glob("*.txt"):
            all_prompts[p.name] = _load_prompt(p.name)
    return all_prompts


def update_prompt(filename: str, new_content: str) -> None:
    """Met à jour un fichier prompt sur le disque et vide le cache mémoire."""
    prompts_dir = Path(__file__).parent.parent / "prompts"
    path = prompts_dir / filename

    # Sécurité basique pour éviter path traversal
    if not path.is_relative_to(prompts_dir):
        raise ValueError("Invalid filename")

    path.write_text(new_content, encoding="utf-8")
    _PROMPT_CACHE[filename] = new_content
    logger.info("Prompt '%s' mis à jour sur disque et en cache mémoire.", filename)


def fetch_dossier_overrides(dossier_id: str) -> dict[str, str]:
    """Récupère les prompts spécifiques à un dossier depuis project-service."""
    if not dossier_id:
        return {}
    try:
        base_url = os.getenv("PROJECT_SERVICE_URL", "http://localhost:8083")
        url = f"{base_url}/api/dossiers/config-ia/overrides/{dossier_id}"
        response = httpx.get(url, timeout=5.0)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        logger.warning("Impossible de récupérer les overrides pour %s: %s", dossier_id, e)
    return {}