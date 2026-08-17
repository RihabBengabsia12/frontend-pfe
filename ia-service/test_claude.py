import asyncio
import json
import httpx

async def run_test():
    prompt = """Tu es un assistant IA spécialisé dans l'allocation de ressources humaines pour des projets informatiques.
Ton but est de comparer un rôle exigé dans un appel d'offres (TDR) avec une liste d'experts disponibles dans une CVthèque.

## Entrées
- <role_requis> : {role}
- <experts_disponibles> : {experts}

## Sortie
```json
[
  {{
    "expertId": "uuid",
    "score": 90
  }}
]
```"""
    
    experts = [
        {"id": "karim", "nom": "Karim", "specialites": ["gestion projet IT", "développement logiciel", "conduite du changement"]},
        {"id": "salma", "nom": "Salma", "specialites": ["architecture SOA", "sécurité SI", "logiciel"]},
        {"id": "amine", "nom": "Amine", "specialites": ["systèmes de scolarité", "conduite du changement"]},
        {"id": "nadia", "nom": "Nadia", "specialites": ["développement we", "mobile", "open source"]}
    ]
    
    roles = [
        "Expert en design graphique des IHM",
        "Expert en architecture des systèmes d'information",
        "Expert en sécurité informatique",
        "Expert en audit de sécurité indépendant",
        "Pool d'experts en développement (2-3 experts)"
    ]
    
    from services.claude_client import call_claude_json
    
    for r in roles:
        sys_p = "Tu es un assistant IA."
        user_p = f"<role_requis>{r}</role_requis>\n<experts_disponibles>{json.dumps(experts)}</experts_disponibles>"
        try:
            res, _ = call_claude_json(sys_p, [{"role": "user", "content": user_p}])
            print(f"Role: {r} -> {res}")
        except Exception as e:
            print(f"Error for {r}: {e}")

if __name__ == "__main__":
    asyncio.run(run_test())
