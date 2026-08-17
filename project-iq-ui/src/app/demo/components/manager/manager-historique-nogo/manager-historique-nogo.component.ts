import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ManagerValidationService } from '../../../service/manager-validation.service';
import { NogoService } from '../../../service/nogo.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-manager-historique-nogo',
  templateUrl: './manager-historique-nogo.component.html',
  styleUrls: ['./manager-historique-nogo.component.scss'],
  providers: []
})
export class ManagerHistoriqueNogoComponent implements OnInit {

  dossiers: any[] = [];
  filteredDossiers: any[] = [];
  loading: boolean = true;
  searchTerm: string = '';

  // Variables pour la consultation (Preview DOCX)
  displayDialog: boolean = false;
  selectedDossier: any = null;
  loadingPreview: boolean = false;
  exportMenuItems: any[] = [];

  constructor(
    private validationService: ManagerValidationService,
    private messageService: MessageService,
    private nogoService: NogoService
  ) { }

  ngOnInit(): void {
    this.exportMenuItems = [
      { label: 'Exporter en CSV', icon: 'pi pi-file-excel', command: () => this.exportCsv() },
      { label: 'Exporter en PDF', icon: 'pi pi-file-pdf', command: () => this.exportPdf() }
    ];
    this.loadNoGoHistory();
  }

  exportCsv() { this.exportRows('Historique_NoGo.csv', false); }
  exportPdf() { this.exportRows('Historique_NoGo.pdf', true); }
  private exportRows(filename: string, pdf: boolean) { const header = ['Dossier', 'Client', 'Statut', 'P-Win']; const rows = this.filteredDossiers.map(d => [d.intituleOffre || '—', d.client || '—', d.status || '—', d.pwinScore ?? 'N/A']); if (pdf) { const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' }); doc.text('Historique No-Go', 40, 38); autoTable(doc, { startY: 55, head: [header], body: rows, styles: { fontSize: 8 } }); doc.save(filename); return; } const e = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`; const blob = new Blob([`\uFEFF${[header, ...rows].map(r => r.map(e).join(';')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }

  loadNoGoHistory() {
    this.loading = true;
    this.validationService.getDossiersWithNoGo().subscribe({
      next: (data) => {
        // Dédupliquer par Titre (intituleOffre) car l'utilisateur a pu créer deux dossiers distincts avec le même document
        const uniqueDossiers = [];
        const titres = new Set();
        for(const d of data) {
            if(d.intituleOffre && !titres.has(d.intituleOffre)) {
                titres.add(d.intituleOffre);
                uniqueDossiers.push(d);
            }
        }
        this.dossiers = uniqueDossiers;
        this.filteredDossiers = [...this.dossiers];
        this.loading = false;
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger l\'historique des No-Go' });
        this.loading = false;
      }
    });
  }

  onSearch() {
    if (!this.searchTerm) {
      this.filteredDossiers = [...this.dossiers];
      return;
    }
    const term = this.searchTerm.toLowerCase();
    this.filteredDossiers = this.dossiers.filter(d => 
      (d.intituleOffre && d.intituleOffre.toLowerCase().includes(term)) ||
      (d.client && d.client.toLowerCase().includes(term))
    );
  }

  downloadReport(dossier: any) {
    if (!dossier.nogoReportPath) {
      this.messageService.add({ severity: 'warn', summary: 'Non disponible', detail: 'Le rapport No-Go est introuvable.' });
      return;
    }
    
    this.selectedDossier = dossier;
    this.displayDialog = true;
    this.loadingPreview = true;

    // Simulation du chargement et de la consultation du rapport DOCX
    this.nogoService.downloadReport(dossier.id).subscribe({
        next: (blob) => {
            this.loadingPreview = false;
            // Utiliser requestAnimationFrame pour s'assurer que la div est rendue avant d'appeler renderAsync
            setTimeout(() => {
                const container = document.getElementById('docx-preview-historique');
                if (container) {
                    import('docx-preview').then(docxPreview => {
                        docxPreview.renderAsync(blob, container, undefined, {
                            className: 'docx',
                            inWrapper: true,
                            ignoreWidth: false,
                            ignoreHeight: false,
                            ignoreFonts: false,
                            breakPages: true,
                            ignoreLastRenderedPageBreak: true,
                            experimental: false,
                            trimXmlDeclaration: true,
                            useBase64URL: false,
                            debug: false,
                        }).catch(e => console.error("Erreur de rendu docx", e));
                    });
                }
            }, 100);
        },
        error: (err) => {
            this.loadingPreview = false;
            this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de télécharger le rapport.' });
        }
    });
  }

  downloadOriginal() {
    if (this.selectedDossier && this.selectedDossier.id) {
        window.open(`/api/dossiers/${this.selectedDossier.id}/download/nogo/blob`, '_blank');
    }
  }

  printReport() {
    const printContent = document.getElementById('docx-preview-historique');
    if (printContent) {
        const originalContents = document.body.innerHTML;
        document.body.innerHTML = printContent.innerHTML;
        window.print();
        document.body.innerHTML = originalContents;
        window.location.reload(); // Recharger pour restaurer les événements Angular
    } else {
        this.messageService.add({ severity: 'warn', summary: 'Attention', detail: 'Le rapport n\'est pas encore chargé.' });
    }
  }

  getStatusBadge(status: string): { severity: string, label: string, icon: string, color: string } {
    switch (status) {
      case 'NO_GO_CONFIRMED':
        return { severity: 'warning', label: 'En attente de décision', icon: 'pi-clock', color: 'orange' };
      case 'ARCHIVED':
        return { severity: 'danger', label: 'Abandonné (Confirmé)', icon: 'pi-times-circle', color: 'red' };
      case 'FORCE_GO':
      case 'PACK_READY':
      case 'PENDING_VALIDATION':
      case 'SUBMITTED':
      case 'AUDIT':
        return { severity: 'success', label: 'Forcé (Poursuite)', icon: 'pi-forward', color: 'green' };
      default:
        // Si le statut a avancé (ex: MATCHING, DRAFTING), c'est qu'il a été forcé
        return { severity: 'success', label: 'Forcé (Poursuite)', icon: 'pi-forward', color: 'green' };
    }
  }

  getScoreColor(score: number): string {
    if (!score) return 'text-500';
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-orange-500';
    return 'text-red-500';
  }
}
