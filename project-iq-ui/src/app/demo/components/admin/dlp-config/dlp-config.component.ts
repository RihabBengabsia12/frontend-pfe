import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MessageService, ConfirmationService } from 'primeng/api';

interface AnonymizationDict {
  id?: string;
  originalWord: string;
  replacementCode?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

@Component({
  selector: 'app-dlp-config',
  templateUrl: './dlp-config.component.html',
  styleUrls: ['./dlp-config.component.scss'],
  providers: [ConfirmationService]
})
export class DlpConfigComponent implements OnInit {
  dictionaries: AnonymizationDict[] = [];
  loading = false;
  isRegenerating = false;

  displayAddDialog = false;
  newWord = '';

  constructor(
    private http: HttpClient, 
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.loadDictionaries();
  }

  loadDictionaries(): void {
    this.loading = true;
    this.http.get<AnonymizationDict[]>('/api/projects/anonymization').subscribe({
      next: (data) => {
        this.dictionaries = data;
        this.loading = false;
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger le dictionnaire.' });
        this.loading = false;
      }
    });
  }

  openAddDialog(): void {
    this.newWord = '';
    this.displayAddDialog = true;
  }

  saveWord(): void {
    if (!this.newWord || this.newWord.trim() === '') return;
    
    const body: AnonymizationDict = {
      originalWord: this.newWord.trim(),
      isActive: true
    };

    this.http.post<AnonymizationDict>('/api/projects/anonymization', body).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Mot-clé ajouté au dictionnaire.' });
        this.displayAddDialog = false;
        this.loadDictionaries();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Ce mot-clé existe peut-être déjà.' });
      }
    });
  }

  toggleActive(dict: AnonymizationDict): void {
    const updated = { ...dict, isActive: dict.isActive };
    this.http.put<AnonymizationDict>(`/api/projects/anonymization/${dict.id}`, updated).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Mis à jour', detail: `Statut modifié pour ${dict.originalWord}` });
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de modifier le statut.' });
        dict.isActive = !dict.isActive; // revert
      }
    });
  }

  deleteWord(id: string): void {
    this.confirmationService.confirm({
      message: 'Voulez-vous vraiment supprimer ce mot-clé ?',
      header: 'Confirmation de suppression',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.http.delete(`/api/projects/anonymization/${id}`).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Mot-clé supprimé.' });
            this.loadDictionaries();
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de supprimer.' });
          }
        });
      }
    });
  }

  forceRegenerate(): void {
    this.isRegenerating = true;
    this.http.post('/api/projects/anonymization/regenerate', {}).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Régénération', detail: 'Tous les codes ont été générés à nouveau.' });
        this.isRegenerating = false;
        this.loadDictionaries();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de régénérer les codes.' });
        this.isRegenerating = false;
      }
    });
  }
}
