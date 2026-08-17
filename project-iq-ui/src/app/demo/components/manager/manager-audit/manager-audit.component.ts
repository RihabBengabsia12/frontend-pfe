import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ManagerValidationService } from '../../../service/manager-validation.service';
import { renderAsync } from 'docx-preview';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-manager-audit',
  templateUrl: './manager-audit.component.html',
  styleUrls: ['./manager-audit.component.scss'],
  providers: []
})
export class ManagerAuditComponent implements OnInit {

  @ViewChild('docxPreview') docxPreview?: ElementRef<HTMLDivElement>;

  archivedDossiers: any[] = [];
  selectedDossier: any = null;
  loading: boolean = true;
  downloading: boolean = false;
  
  // Preview DOCX
  displayDialog: boolean = false;
  loadingPreview: boolean = false;
  previewError = '';

  constructor(
    private validationService: ManagerValidationService,
    private messageService: MessageService,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.loadArchivedDossiers();
  }

  loadArchivedDossiers() {
    this.loading = true;
    this.validationService.getArchivedDossiers().subscribe({
      next: (data) => {
        this.archivedDossiers = data;
        const requestedId = this.route.snapshot.queryParamMap.get('dossierId');
        const requestedDossier = requestedId
          ? this.archivedDossiers.find(dossier => dossier.id === requestedId)
          : undefined;
        if (requestedDossier) {
          this.selectDossier(requestedDossier);
          this.downloadAuditReport();
        } else if (this.archivedDossiers.length > 0) {
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
    this.previewError = '';
    this.validationService.downloadDocument(this.selectedDossier.id, 'audit').subscribe({
      next: async (file) => {
        try {
          // Crée d'abord le conteneur Angular ; sans cela ViewChild est vide et
          // docx-preview ne peut rien dessiner.
          this.loadingPreview = false;
          await new Promise(resolve => setTimeout(resolve));
          const container = this.docxPreview?.nativeElement;
          if (!container) throw new Error('Zone de previsualisation indisponible.');
          container.replaceChildren();
          await renderAsync(file, container, undefined, {
            className: 'projectiq-audit-docx', inWrapper: true, breakPages: true,
            ignoreLastRenderedPageBreak: false
          });
        } catch {
          this.previewError = 'Impossible d’afficher ce rapport dans le lecteur. Vous pouvez le télécharger au format DOCX.';
        } finally { this.loadingPreview = false; }
      },
      error: () => {
        this.previewError = 'Le rapport d’audit est indisponible au téléchargement.';
        this.loadingPreview = false;
      }
    });
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
