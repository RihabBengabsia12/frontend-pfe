import json
import numpy as np
from pathlib import Path
from typing import List, Dict
import pdfplumber
from sentence_transformers import SentenceTransformer
import re

class SemanticChunker:
    def __init__(self):
        self.model = SentenceTransformer('all-MiniLM-L6-v2')  # 384 dim, français OK
        print("🤖 Modèle sémantique chargé (384 dim)")
    
    def extraire_pdf(self, pdf_path: Path) -> str:
        """PDF → texte"""
        with pdfplumber.open(pdf_path) as pdf:
            return '\n'.join(page.extract_text() or '' for page in pdf.pages)
    
    def split_sentences(self, texte: str) -> List[str]:
        """Split phrases intelligentes (pas mots-clés!)"""
        # Phrases complètes + titres
        sentences = re.split(r'(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|\!|\n)\s', texte)
        
        # Fusionne trop courts + nettoyage
        result = []
        buffer = ""
        for s in sentences:
            s = s.strip()
            if len(s) > 30:  # Min 30 chars
                buffer += s + " "
                if len(buffer) > 1500:  # ~384 tokens
                    result.append(buffer.strip())
                    buffer = ""
        if buffer:
            result.append(buffer)
        return result
    
    def score_semantique_pure(self, sentences: List[str]) -> List[tuple]:
        """Score = similarité cosinus entre phrases adjacentes"""
        if len(sentences) < 2:
            return [(1.0, s) for s in sentences]
        
        # Embeddings
        embeddings = self.model.encode(sentences)
        
        scores = []
        for i, emb in enumerate(embeddings):
            # Similarité avec moyenne voisines
            if i == 0:
                sim = np.dot(embeddings[i], embeddings[i+1])
            elif i == len(embeddings) - 1:
                sim = np.dot(embeddings[i], embeddings[i-1])
            else:
                sim = np.mean([
                    np.dot(emb, embeddings[i-1]),
                    np.dot(emb, embeddings[i+1])
                ])
            scores.append((max(0, sim), sentences[i]))
        
        return sorted(scores, key=lambda x: x[0], reverse=True)
    
    def processer_dossier(self, dossier: str) -> Dict:
        """🔥 Dossier entier → chunks.json"""
        dossier_path = Path(dossier)
        resultats = {}
        
        for pdf in dossier_path.glob("*.pdf"):
            print(f"📄 {pdf.name}...")
            
            texte = self.extraire_pdf(pdf)
            sentences = self.split_sentences(texte)
            
            # Score sémantique PURE
            scored = self.score_semantique_pure(sentences)
            
            # Top 30% (plus cohérent)
            top_sentences = [s for _, s in scored[:max(5, len(scored)//3)]]
            
            texte_chunk = " ".join(top_sentences)
            
            resultats[pdf.stem] = {
                'chunks': top_sentences,
                'nb_chunks': len(top_sentences),
                'tokens': len(texte_chunk) // 4,
                'similarite_moyenne': round(np.mean([s for s, _ in scored[:len(top_sentences)]]), 3)
            }
        
        # JSON RAG
        output = dossier_path / "chunks_semantic.json"
        with open(output, 'w', encoding='utf-8') as f:
            json.dump(resultats, f, ensure_ascii=False, indent=2)
        
        return resultats

# 🔥 USAGE SIMPLE
if __name__ == "__main__":
    import sys
    from pathlib import Path
    
    # FIX: Fichier → dossier parent | Dossier → dossier
    arg = sys.argv[1] if len(sys.argv) > 1 else "DPs"
    dossier = Path("DPs") if arg == "DPs" else (Path(arg).parent if Path(arg).exists() else Path(arg))
    
    print(f"📁 Traitement dossier: {dossier}")
    
    chunker = SemanticChunker()
    resultats = chunker.processer_dossier(str(dossier))
    
    total_tokens = sum(r['tokens'] for r in resultats.values())
    print(f"\n🎉 SEMANTIC CHUNKER:")
    print(f"📦 {len(resultats)} fichiers → {total_tokens} tokens")
    print(f"💾 {dossier}/chunks_semantic.json OK!")