# 1. Utilisation d'une image de base allégée et officielle
FROM python:3.11-slim as builder

# 2. Définition des variables d'environnement Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# 3. Installation des dépendances (séparée du code pour profiter du cache Docker)
COPY requirements.txt .
RUN pip install --user -r requirements.txt

# 4. Image finale (multistage build pour plus de sécurité et de légèreté)
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Création d'un utilisateur non-root pour la sécurité (bonne pratique)
RUN addgroup --system appgroup && adduser --system --group appuser

WORKDIR /app

# Copie depuis l'étape builder
COPY --chown=appuser:appgroup --from=builder /root/.local /home/appuser/.local
ENV PATH=/home/appuser/.local/bin:$PATH
ENV PYTHONPATH=/home/appuser/.local/lib/python3.11/site-packages

# Copie du code avec droits
COPY --chown=appuser:appgroup . .

USER appuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]