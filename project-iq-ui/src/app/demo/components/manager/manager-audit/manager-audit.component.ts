import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ManagerValidationService } from '../../../service/manager-validation.service';

@Component({
  selector: 'app-manager-audit',
  templateUrl: './manager-audit.component.html',
  styleUrls: ['./manager-audit.component.scss'],
  providers: [MessageService]
})
export class ManagerAuditComponent implements OnInit {

  archivedDossiers: any[] = [];
  selectedDossier: any = null;
  loading: boolean = true;
  downloading: boolean = false;
  
  // Preview DOCX
  displayDialog: boolean = false;
  loadingPreview: boolean = false;

  constructor(
    private validationService: ManagerValidationService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.loadArchivedDossiers();
  }

  loadArchivedDossiers() {
    this.loading = true;
    this.validationService.getArchivedDossiers().subscribe({
      next: (data) => {
        this.archivedDossiers = data;
        if (this.archivedDossiers.length > 0) {
          this.selectDossier(this.archivedDossiers[0]);
        } else {
          this.selectedDossier = null;
        }
        this.loading = false;
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger les archives' });
        this.loading = false;
      }
    });
  }

  selectDossier(dossier: any) {
    this.selectedDossier = dossier;
  }

  downloadAuditReport() {
    if (!this.selectedDossier?.auditReportPath) {
      this.messageService.add({ severity: 'info', summary: 'Information', detail: 'Aucun rapport d\'audit n\'est rattaché à ce dossier.' });
      return;
    }
    
    // Au lieu de juste télécharger, on ouvre la modale de prévisualisation
    this.displayDialog = true;
    this.loadingPreview = true;
    
    // Simulation du chargement du lecteur DOCX
    setTimeout(() => {
      this.loadingPreview = false;
    }, 1500);
  }

  downloadOriginal() {
    this.downloading = true;
    setTimeout(() => {
      this.downloading = false;
      this.messageService.add({ severity: 'success', summary: 'Téléchargement', detail: 'Le rapport DOCX a été téléchargé avec succès.' });
    }, 1000);
  }

  getScoreColor(score: number): string {
    if (!score) return 'text-500';
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-orange-500';
    return 'text-red-500';
  }
}
