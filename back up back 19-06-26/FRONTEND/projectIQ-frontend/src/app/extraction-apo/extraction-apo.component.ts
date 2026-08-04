import { Component } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http'; // Ajout de HttpClientModule
import { CommonModule } from '@angular/common'; // Ajout de CommonModule pour le HTML (*ngIf)

@Component({
  selector: 'app-extraction-apo',
  standalone: true,        // <--- CRUCIAL : Rend le composant autonome
  imports: [CommonModule, HttpClientModule], // <--- CRUCIAL : Importe les outils nécessaires
  templateUrl: './extraction-apo.component.html',
  styleUrls: ['./extraction-apo.component.css']
})
export class ExtractionApoComponent {
  selectedFile: File | null = null;
  status: 'idle' | 'extracting' | 'success' | 'error' = 'idle';
  
  // Stockage des données pour l'affichage et les chemins de fichiers
  extractionData: any = null;
  docxPath: string | null = null;
  jsonPath: string | null = null;

  private serverUrl = 'http://127.0.0.1:8000';

  constructor(private http: HttpClient) {}

  // ÉTAPE 1 : Sélection du fichier
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.status = 'idle';
      this.extractionData = null;
    }
  }

  // ÉTAPE 2 : Extraction via Python (FastAPI)
  onExtract() {
    if (!this.selectedFile) return;

    this.status = 'extracting';
    const formData = new FormData();
    formData.append('file', this.selectedFile);

    this.http.post<any>(`${this.serverUrl}/api/extract-apo`, formData)
      .subscribe({
        next: (res) => {
          this.status = 'success';
          // Récupération des données renvoyées par ton api.py
          this.extractionData = res.data; 
          this.docxPath = res.docx_path;
          this.jsonPath = res.json_path;
        },
        error: (err) => {
          console.error("Erreur Backend:", err);
          this.status = 'error';
        }
      });
  }

  // ÉTAPE 3 : Exportation (Téléchargement)
  onDownloadDocx() {
    if (this.docxPath) {
      const url = `${this.serverUrl}/api/download?path=${encodeURIComponent(this.docxPath)}`;
      window.open(url, '_blank');
    }
  }

  onDownloadJson() {
    if (this.jsonPath) {
      const url = `${this.serverUrl}/api/download?path=${encodeURIComponent(this.jsonPath)}`;
      window.open(url, '_blank');
    }
  }
}