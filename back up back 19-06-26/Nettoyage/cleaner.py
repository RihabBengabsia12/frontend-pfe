
import re
import logging
from collections import Counter

# ── Configuration du logger ────────────────────────────────────────────────────
logger = logging.getLogger("ProjectIQ.Nettoyage")

PATTERN_NUMERO_PAGE    = re.compile(r"^\s*[-–—]?\s*\d+\s*[-–—]?\s*$", re.MULTILINE)
PATTERN_PAGE_SUR       = re.compile(r"^\s*[Pp]age\s+\d+\s+sur\s+\d+\s*$", re.MULTILINE)
PATTERN_PAGE_OF        = re.compile(r"^\s*[Pp]age\s+\d+\s+of\s+\d+\s*$", re.MULTILINE)
PATTERN_LIGNES_POINTS  = re.compile(r"\.{4,}")
PATTERN_LIGNES_TIRETS  = re.compile(r"-{4,}")
PATTERN_LIGNES_EGAL    = re.compile(r"={4,}")
PATTERN_LIGNES_SOUS    = re.compile(r"_{4,}")
PATTERN_SYMBOLES_LISTE = re.compile(r"^[■□►◄●•◦‣✓✗✔✘▪▫→←]\s*", re.MULTILINE)
PATTERN_ESPACES_MULTI  = re.compile(r"[ \t]+")
PATTERN_LIGNES_VIDES   = re.compile(r"\n{3,}")
PATTERN_INSECABLE      = re.compile(r"\xa0|\u00a0|\u2009|\u200b|\ufeff")

MARQUEURS_SECTIONS = [
    # Numérotation standard
    (re.compile(r"^\s*(\d+[\.\)]\s+[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝ].{3,60})\s*$", re.MULTILINE), "section"),
    (re.compile(r"^\s*([A-Z]{3,}(?:\s+[A-Z]{2,}){0,5})\s*$", re.MULTILINE), "titre_majuscule"),
    # Mots-clés sections typiques DPs
    (re.compile(r"^\s*((?:ARTICLE|SECTION|CHAPITRE|PARTIE|ANNEXE|CLAUSE)\s+[\dIVXivx]+.*)\s*$", re.MULTILINE), "section"),
]




def nettoyer_texte(texte_brut: str) -> dict:
  

    if not texte_brut or len(texte_brut.strip()) < 10:
        return _erreur("Texte brut vide ou insuffisant")

    logger.info(f"Début nettoyage | {len(texte_brut)} caractères bruts")

    stats_avant = _calculer_stats(texte_brut)
    texte       = texte_brut

    # ── Étape 1 : Suppression en-têtes / pieds de page ────────────────────────
    texte = _supprimer_entetes_pieds(texte)
    logger.debug(f"Étape 1 terminée | {len(texte)} chars")

    # ── Étape 2 : Normalisation espaces et caractères invisibles ──────────────
    texte = _normaliser_espaces(texte)
    logger.debug(f"Étape 2 terminée | {len(texte)} chars")

    # ── Étape 3 : Réduction lignes vides ──────────────────────────────────────
    texte = _reduire_lignes_vides(texte)
    logger.debug(f"Étape 3 terminée | {len(texte)} chars")

    # ── Étape 4 : Suppression artefacts mise en page ──────────────────────────
    texte = _supprimer_artefacts(texte)
    logger.debug(f"Étape 4 terminée | {len(texte)} chars")

    # ── Étape 5 : Correction encodage (ftfy) ──────────────────────────────────
    texte = _corriger_encodage(texte)
    logger.debug(f"Étape 5 terminée | {len(texte)} chars")

    # ── Étape 6 : Segmentation en sections ────────────────────────────────────
    sections = _segmenter_sections(texte)
    logger.debug(f"Étape 6 terminée | {len(sections)} sections détectées")

    stats_apres = _calculer_stats(texte)
    reduction   = round((1 - len(texte) / len(texte_brut)) * 100, 1)

    logger.info(
        f"Nettoyage terminé | {stats_apres['nb_caracteres']} chars | "
        f"réduction={reduction}% | {len(sections)} sections"
    )

    return {
        "succes"        : True,
        "texte_nettoye" : texte.strip(),
        "sections"      : sections,
        "stats"         : {
            "avant"     : stats_avant,
            "apres"     : stats_apres,
            "reduction_pct" : reduction
        },
        "erreur"        : None
    }



def _supprimer_entetes_pieds(texte: str) -> str:
  
    lignes     = texte.split("\n")
    compteur   = Counter(ligne.strip() for ligne in lignes if ligne.strip())
    a_supprimer = {ligne for ligne, count in compteur.items() if count > 3 and len(ligne) < 120}

    lignes_filtrees = []
    for ligne in lignes:
        ligne_propre = ligne.strip()
        if (ligne_propre in a_supprimer
                or PATTERN_NUMERO_PAGE.match(ligne)
                or PATTERN_PAGE_SUR.match(ligne)
                or PATTERN_PAGE_OF.match(ligne)):
            continue
        lignes_filtrees.append(ligne)

    supprimees = len(lignes) - len(lignes_filtrees)
    if supprimees > 0:
        logger.debug(f"En-têtes/pieds supprimés : {supprimees} lignes | patterns : {len(a_supprimer)}")

    return "\n".join(lignes_filtrees)




def _normaliser_espaces(texte: str) -> str:
    """
    Normalise tous les types d'espaces et tabulations.
    Remplace les caractères invisibles problématiques.
    """
    # Espaces insécables et caractères Unicode invisibles → espace normal
    texte = PATTERN_INSECABLE.sub(" ", texte)

    # Tabulations → espace simple
    texte = texte.replace("\t", " ")

    # Espaces multiples sur une même ligne → espace unique
    texte = PATTERN_ESPACES_MULTI.sub(" ", texte)

    # Retours chariot Windows → retour à la ligne Unix
    texte = texte.replace("\r\n", "\n").replace("\r", "\n")

    return texte




def _reduire_lignes_vides(texte: str) -> str:
    """
    Réduit les séquences de 3+ lignes vides à 2 lignes vides maximum.
    Préserve la séparation visuelle entre les sections.
    """
    return PATTERN_LIGNES_VIDES.sub("\n\n", texte)



def _supprimer_artefacts(texte: str) -> str:
    """
    Supprime les artefacts visuels de mise en page qui parasitent l'extraction :
    lignes de points, tirets, symboles de listes graphiques, etc.
    """
    # Lignes de séparation graphiques
    texte = PATTERN_LIGNES_POINTS.sub("", texte)
    texte = PATTERN_LIGNES_TIRETS.sub("", texte)
    texte = PATTERN_LIGNES_EGAL.sub("", texte)
    texte = PATTERN_LIGNES_SOUS.sub("", texte)

    # Symboles de liste graphiques en début de ligne
    texte = PATTERN_SYMBOLES_LISTE.sub("", texte)

    # Sauts de page PDF (\f)
    texte = texte.replace("\f", "\n")

    return texte



def _corriger_encodage(texte: str) -> str:
    """
    Corrige les problèmes d'encodage fréquents dans les PDFs FR/AR/EN.
    Utilise ftfy si disponible, sinon corrections manuelles basiques.
    """
    try:
        import ftfy
        texte = ftfy.fix_text(texte)
        logger.debug("Encodage corrigé via ftfy")
        return texte

    except ImportError:
        logger.debug("ftfy non disponible — corrections manuelles appliquées")

        # Corrections manuelles des encodages cassés les plus fréquents
        corrections = {
            "Ã©": "é",
            "Ã¨": "è",
            "Ã ": "à",
            "Ã¢": "â",
            "Ã®": "î",
            "Ã´": "ô",
            "Ã»": "û",
            "Ã§": "ç",
            "â\x80\x99": "'",
            "â\x80\x9c": '"',
            "â\x80\x9d": '"',
            "â\x80\x94": "\u2014",
            "â\x80\x93": "\u2013",
            "Â°": "°",
            "Â«": "\u00ab",
            "Â»": "\u00bb"
        }
        for mauvais, bon in corrections.items():
            texte = texte.replace(mauvais, bon)

        return texte




def _segmenter_sections(texte: str) -> dict:
    """
    Découpe le texte en sections nommées selon les titres détectés.
    Retourne un dictionnaire {nom_section: texte_section}.
    Chercher le budget dans la section 'budget' est 3x plus fiable
    que dans tout le document.
    """
    sections        = {}
    section_courante = "introduction"
    contenu_courant  = []

    for ligne in texte.split("\n"):
        ligne_propre = ligne.strip()

        # Détecter si la ligne est un titre de section
        nom_section = _detecter_titre(ligne_propre)

        if nom_section:
            # Sauvegarder la section précédente
            if contenu_courant:
                texte_section = "\n".join(contenu_courant).strip()
                if texte_section:
                    sections[section_courante] = texte_section

            # Démarrer une nouvelle section
            section_courante = nom_section.lower()[:50]
            contenu_courant  = []

        else:
            contenu_courant.append(ligne)

    # Sauvegarder la dernière section
    if contenu_courant:
        texte_section = "\n".join(contenu_courant).strip()
        if texte_section:
            sections[section_courante] = texte_section

    # Section "complet" — texte intégral (toujours présent)
    sections["__complet__"] = texte

    logger.debug(f"Sections détectées : {[k for k in sections.keys() if k != '__complet__']}")
    return sections


def _detecter_titre(ligne: str) -> str:
    """
    Détermine si une ligne est un titre de section.
    Retourne le nom normalisé de la section ou None.
    """
    if not ligne or len(ligne) < 3 or len(ligne) > 120:
        return None

    # Mots-clés sections typiques des DPs
    mots_cles_sections = {
        "budget": ["budget", "montant", "coût", "coût estimé", "financement", "prix"],
        "objectifs": ["objectif", "but", "finalité", "mission"],
        "experts": ["expert", "personnel", "ressources humaines", "profil", "cv"],
        "calendrier": ["calendrier", "durée", "délai", "planning", "échéancier", "date"],
        "livrables": ["livrable", "produit attendu", "résultat", "output"],
        "criteres": ["critère", "évaluation", "sélection", "qualification", "notation"],
        "contexte": ["contexte", "présentation", "introduction", "background"],
        "risques": ["risque", "hypothèse", "contrainte"],
        "garanties": ["garantie", "caution", "cautionnement"],
        "penalites": ["pénalité", "retard", "sanction"],
    }

    ligne_lower = ligne.lower()

    for nom_section, mots in mots_cles_sections.items():
        if any(mot in ligne_lower for mot in mots):
            return nom_section

    # Lignes en MAJUSCULES (souvent des titres dans les DPs)
    if ligne.isupper() and 5 < len(ligne) < 80:
        return ligne.lower().replace(" ", "_")[:40]

    # Lignes commençant par un numéro (1. ou 1.1 ou Article 3)
    if re.match(r"^(?:\d+[\.\)]\s|[Aa]rticle\s+\d+|[Cc]hapitre\s+\d+)", ligne):
        return re.sub(r"[^\w\s]", "", ligne.lower())[:40].strip().replace(" ", "_")

    return None




def _calculer_stats(texte: str) -> dict:
    """Calcule les statistiques basiques d'un texte."""
    lignes = texte.split("\n")
    return {
        "nb_caracteres"   : len(texte),
        "nb_mots"         : len(texte.split()),
        "nb_lignes"       : len(lignes),
        "nb_lignes_vides" : sum(1 for l in lignes if not l.strip())
    }



def _erreur(message: str) -> dict:
    """Construit un résultat d'erreur standardisé."""
    logger.error(f"Echec nettoyage : {message}")
    return {
        "succes"        : False,
        "texte_nettoye" : "",
        "sections"      : {},
        "stats"         : {},
        "erreur"        : message
    }




if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s — %(message)s")

    chemin_txt = sys.argv[1] if len(sys.argv) > 1 else None

    if chemin_txt:
        with open(chemin_txt, "r", encoding="utf-8") as f:
            texte_test = f.read()
    else:
        texte_test = "Texte de test\n\n\n\n\nPage 1 sur 10\n\nObjectifs\nObjectif principal..."

    resultat = nettoyer_texte(texte_test)

    print("\n" + "=" * 60)
    print("  RÉSULTAT NETTOYAGE")
    print("=" * 60)

    if resultat["succes"]:
        s = resultat["stats"]
        print(f"Avant  : {s['avant']['nb_caracteres']} chars | {s['avant']['nb_mots']} mots")
        print(f"Après  : {s['apres']['nb_caracteres']} chars | {s['apres']['nb_mots']} mots")
        print(f"Réduction : {s['reduction_pct']}%")
        print(f"Sections  : {[k for k in resultat['sections'].keys() if k != '__complet__']}")
    else:
        print(f"Erreur : {resultat['erreur']}")

    print("=" * 60)