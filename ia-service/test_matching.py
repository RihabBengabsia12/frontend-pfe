import httpx
import asyncio
import json

async def test_matching():
    req = {
        "roleRequis": "Expert en sécurité informatique",
        "expertsDisponibles": [
            {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "nom": "Alice Sec",
                "specialites": ["Sécurité", "Audit"]
            }
        ]
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post("http://localhost:8000/matching/match-experts", json=req)
            print("Status:", resp.status_code)
            print("Response:", resp.text)
        except Exception as e:
            print("Exception:", str(e))

asyncio.run(test_matching())
