import os
import logging
from pathlib import Path
import fitz

logger = logging.getLogger("ProjectIQ.Lecture")

TAILLE_MAX_MB        = 50
SEUIL_TEXTE_NATIF    = 100   # nb caractères minimum pour considérer une page comme native
EXTENSIONS_VALIDES   = {".pdf", ".docx", ".doc", ".txt"}
LANGUES_OCR          = ["fr", "en", "ar"]


def lire_document(chemin: str) -> dict:
   
    logger.info(f"Lecture : {chemin}")

    verification = _verifier_fichier(chemin)
    if not verification["valide"]:
        return _erreur(verification["message"])

    extension = Path(chemin).suffix.lower()

    try:
        if extension == ".pdf":
            resultat = _lire_pdf(chemin)
        elif extension in (".docx", ".doc"):
            resultat = _lire_docx(chemin)
        elif extension == ".txt":
            resultat = _lire_txt(chemin)
        else:
            return _erreur(f"Format non supporté : {extension}")

    except Exception as e:
        logger.exception("Erreur inattendue lors de la lecture")
        return _erreur(f"Erreur lecture : {str(e)}")

    if not resultat.get("texte") or len(resultat["texte"].strip()) < 10:
        return _erreur("Texte extrait vide ou insuffisant")

    texte        = resultat["texte"]
    nb_mots      = len(texte.split())
    nb_caracteres = len(texte)

    logger.info(
        f"Lecture reussie | methode={resultat['methode']} | "
        f"pages={resultat.get('nb_pages', 0)} | "
        f"mots={nb_mots} | caracteres={nb_caracteres}"
    )

    return {
        "succes"        : True,
        "texte"         : texte,
        "methode"       : resultat["methode"],
        "nb_pages"      : resultat.get("nb_pages", 0),
        "nb_caracteres" : nb_caracteres,
        "nb_mots"       : nb_mots,
        "erreur"        : None
    }



def _verifier_fichier(chemin: str) -> dict:
    """Vérifie l'existence, la taille et l'extension du fichier."""

    if not os.path.exists(chemin):
        return {"valide": False, "message": f"Fichier introuvable : {chemin}"}

    if not os.path.isfile(chemin):
        return {"valide": False, "message": f"Le chemin ne pointe pas vers un fichier : {chemin}"}

    taille_octets = os.path.getsize(chemin)

    if taille_octets == 0:
        return {"valide": False, "message": "Fichier vide (0 octet)"}

    taille_mb = taille_octets / (1024 * 1024)
    if taille_mb > TAILLE_MAX_MB:
        return {"valide": False, "message": f"Fichier trop volumineux : {taille_mb:.1f} MB (max {TAILLE_MAX_MB} MB)"}

    extension = Path(chemin).suffix.lower()
    if extension not in EXTENSIONS_VALIDES:
        return {"valide": False, "message": f"Format non supporté : {extension} | Formats acceptés : {', '.join(EXTENSIONS_VALIDES)}"}

    return {"valide": True, "message": ""}


def _lire_pdf(chemin: str) -> dict:
    """
    Lit un PDF en détectant automatiquement s'il est natif ou scanné.
    Traite les PDFs mixtes (certaines pages natives, d'autres scannées).
    """
    import fitz  # PyMuPDF

    doc = fitz.open(chemin)

    if doc.needs_pass:
        raise ValueError("PDF protégé par mot de passe — déverrouillez le fichier avant traitement")

    nb_pages       = len(doc)
    texte_pages    = []
    pages_natives  = 0
    pages_scannees = 0

    for numero_page, page in enumerate(doc, start=1):

        texte_natif = page.get_text().strip()

        if len(texte_natif) >= SEUIL_TEXTE_NATIF:
            # Page native — texte directement lisible
            texte_pages.append(texte_natif)
            pages_natives += 1
            logger.debug(f"Page {numero_page}/{nb_pages} : native ({len(texte_natif)} chars)")

        else:
            # Page scannée — passage par OCR
            texte_ocr = _ocr_page(page, numero_page)
            if texte_ocr:
                texte_pages.append(texte_ocr)
                pages_scannees += 1
            logger.debug(f"Page {numero_page}/{nb_pages} : OCR ({len(texte_ocr) if texte_ocr else 0} chars)")

    doc.close()

    if pages_scannees == 0:
        methode = "PDF natif"
    elif pages_natives == 0:
        methode = "PDF scanné (OCR)"
    else:
        methode = f"PDF mixte ({pages_natives} pages natives, {pages_scannees} pages OCR)"

    logger.info(f"PDF traité | {methode} | {nb_pages} pages")

    return {
        "texte"    : "\n\n".join(texte_pages),
        "methode"  : methode,
        "nb_pages" : nb_pages
    }




def _ocr_page(page, numero_page: int) -> str:
    """
    Applique l'OCR sur une page scannée.
    Tente EasyOCR en priorité, Tesseract en fallback.
    Supporte le français, l'anglais et l'arabe.
    """
    import easyocr
    import pytesseract
    from PIL import Image
    import numpy as np
    import io

    # Rendu de la page en image
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # zoom x2
    img_bytes = pix.tobytes("png")

    texte_page = ""

    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

    # EasyOCR
    try:
        reader = easyocr.Reader(LANGUES_OCR, gpu=False, verbose=False)
        img_arr = np.array(Image.open(io.BytesIO(img_bytes)))
        res = reader.readtext(img_arr)
        texte_page = " ".join([r[1] for r in res if r[2] > 0.3])
        if texte_page.strip():
            logger.info(f"Page {numero_page} : OCR EasyOCR réussi")
            return texte_page
    except Exception as e:
        logger.debug(f"Page {numero_page} : EasyOCR indisponible ({e})")

    # Tesseract fallback
    try:
        img_pil = Image.open(io.BytesIO(img_bytes))
        texte_page = pytesseract.image_to_string(img_pil, lang="fra+eng+ara")
        if texte_page.strip():
            logger.info(f"Page {numero_page} : OCR Tesseract réussi")
            return texte_page
    except Exception as e:
        logger.warning(f"Page {numero_page} : Tesseract indisponible ({e})")

    logger.warning(f"Page {numero_page} : OCR échoué — page ignorée")
    return ""




def _lire_docx(chemin: str) -> dict:
    """
    Lit un fichier Word (.docx).
    Extrait les paragraphes ET les tableaux (le budget est souvent en tableau).
    """
    from docx import Document
    from docx.oxml.ns import qn

    doc      = Document(chemin)
    contenu  = []
    nb_pages = 0  # DOCX ne stocke pas le nb de pages directement

    for element in doc.element.body:

        tag = element.tag.split("}")[-1] if "}" in element.tag else element.tag

        if tag == "p":
            texte = element.text_content() if hasattr(element, "text_content") else ""
            # Extraction manuelle du texte du paragraphe
            texte = "".join(
                node.text or ""
                for node in element.iter()
                if node.tag.endswith("}t")
            )
            if texte.strip():
                contenu.append(texte.strip())

        # Tableau (budget, livrables, experts souvent en tableau)
        elif tag == "tbl":
            for ligne in element.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tr"):
                cellules = []
                for cellule in ligne.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tc"):
                    texte_cellule = "".join(
                        node.text or ""
                        for node in cellule.iter()
                        if node.tag.endswith("}t")
                    )
                    if texte_cellule.strip():
                        cellules.append(texte_cellule.strip())
                if cellules:
                    contenu.append(" | ".join(cellules))

    for para in doc.paragraphs:
        for run in para.runs:
            if run._element.find(qn("w:lastRenderedPageBreak")) is not None:
                nb_pages += 1
    nb_pages = max(nb_pages, 1)

    texte_final = "\n".join(contenu)
    logger.info(f"DOCX traité | {len(doc.paragraphs)} paragraphes | ~{nb_pages} pages")

    return {
        "texte"    : texte_final,
        "methode"  : "DOCX",
        "nb_pages" : nb_pages
    }




def _lire_txt(chemin: str) -> dict:
    """Lit un fichier texte en détectant automatiquement l'encodage."""

    encodages = ["utf-8", "utf-8-sig", "latin-1", "cp1252", "cp1256"]  # cp1256 pour arabe

    for encodage in encodages:
        try:
            with open(chemin, "r", encoding=encodage) as f:
                texte = f.read()
            logger.info(f"TXT traité | encodage={encodage} | {len(texte)} chars")
            return {
                "texte"    : texte,
                "methode"  : f"TXT ({encodage})",
                "nb_pages" : 1
            }
        except (UnicodeDecodeError, LookupError):
            continue

    raise ValueError("Encodage du fichier TXT non reconnu — essayez de convertir en UTF-8")



def _erreur(message: str) -> dict:
    """Construit un résultat d'erreur standardisé."""
    logger.error(f"Echec lecture : {message}")
    return {
        "succes"        : False,
        "texte"         : "",
        "methode"       : "",
        "nb_pages"      : 0,
        "nb_caracteres" : 0,
        "nb_mots"       : 0,
        "erreur"        : message
    }




if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s — %(message)s")

    chemin   = sys.argv[1] if len(sys.argv) > 1 else "test.pdf"
    resultat = lire_document(chemin)

    print("\n" + "=" * 60)
    print("  RÉSULTAT LECTURE")
    print("=" * 60)

    if resultat["succes"]:
        print(f"Statut        : OK")
        print(f"Méthode       : {resultat['methode']}")
        print(f"Pages         : {resultat['nb_pages']}")
        print(f"Mots          : {resultat['nb_mots']}")
        print(f"Caractères    : {resultat['nb_caracteres']}")
        print(f"\n--- Aperçu (500 premiers caractères) ---")
        print(resultat["texte"][:500])
    else:
        print(f"Statut        : ERREUR")
        print(f"Message       : {resultat['erreur']}")

    print("=" * 60)