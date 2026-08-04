"""
ProjectIQ-PFE — ia-service
Point d'entrée FastAPI. Enregistre tous les routeurs.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
import logging
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi import Request

from routers.extraction_router import router as extraction_router
from routers.scoring_router    import router as scoring_router
from routers.matching_router   import router as matching_router
from routers.generation_router import router as generation_router
from routers.audit_router      import router as audit_router
from routers.config_router     import router as config_router

app = FastAPI(
    title="ProjectIQ ia-service",
    description="Service IA Claude pour l'analyse d'appels d'offres — Egis",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(extraction_router, prefix="/extract",  tags=["Extraction"])
app.include_router(scoring_router,    prefix="/scoring",  tags=["Scoring"])
app.include_router(matching_router,   prefix="/matching", tags=["Matching"])
app.include_router(generation_router, prefix="/generate", tags=["Generation"])
app.include_router(audit_router,      prefix="/generate", tags=["Audit"])
app.include_router(config_router,     prefix="/config",   tags=["Configuration"])

logger = logging.getLogger(__name__)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    body = await request.body()
    logger.error(f"422 Validation Error: {exc.errors()} \nBody: {body.decode('utf-8', errors='replace')}")
    return JSONResponse(status_code=422, content={"detail": exc.errors(), "body": body.decode('utf-8', errors='replace')})


@app.get("/health", tags=["Health"])
async def health():
    try:
        # Ping basique pour vérifier la connectivité réseau vers l'API Anthropic
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get("https://api.anthropic.com")
            # Anthropic renvoie souvent 401 ou 404 sur la racine GET, mais tant qu'on a une réponse, le réseau est UP
            if resp.status_code:
                return {"status": "ok", "service": "ia-service", "claude_api": "connected"}
    except Exception as e:
        return {"status": "error", "service": "ia-service", "claude_api": "disconnected", "error": str(e)}
    
    return {"status": "error", "service": "ia-service"}