import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ManagerValidationService } from '../../../service/manager-validation.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-manager-historique-decisions',
  templateUrl: './manager-historique-decisions.component.html',
  styleUrls: ['./manager-historique-decisions.component.scss'],
  providers: []
})
export class ManagerHistoriqueDecisionsComponent implements OnInit {

  dossiers: any[] = [];
  filteredDossiers: any[] = [];
  loading: boolean = true;
  searchTerm: string = '';

  selectedDossier: any = null;
  timelineEvents: any[] = [];
  loadingTimeline: boolean = false;
  exportMenuItems: any[] = [];

  constructor(
    private validationService: ManagerValidationService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.exportMenuItems = [
      { label: 'Exporter en CSV', icon: 'pi pi-file-excel', command: () => this.exportCsv() },
      { label: 'Exporter en PDF', icon: 'pi pi-file-pdf', command: () => this.exportPdf() }
    ];
    this.loadDossiers();
  }

  exportCsv() { this.exportRows('Historique_Decisions.csv', false); }
  exportPdf() { this.exportRows('Historique_Decisions.pdf', true); }
  private exportRows(filename: string, pdf: boolean) { const header = ['Dossier', 'Client', 'Statut', 'P-Win']; const rows = this.filteredDossiers.map(d => [d.intituleOffre || '—', d.client || '—', d.status || '—', d.pwinScore ?? 'N/A']); if (pdf) { const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' }); doc.text('Historique des décisions', 40, 38); autoTable(doc, { startY: 55, head: [header], body: rows, styles: { fontSize: 8 } }); doc.save(filename); return; } const e = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`; const blob = new Blob([`\uFEFF${[header, ...rows].map(r => r.map(e).join(';')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }

  loadDossiers() {
    this.loading = true;
    this.validationService.getDossiersWithDecisions().subscribe({
      next: (data) => {
        // Déduplication par ID au cas où le backend renvoie des jointures multiples
        const uniqueData = Array.from(new Map(data.map(item => [item.id, item])).values());
        
        // Tri par date de mise à jour décroissante
        uniqueData.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        
        this.dossiers = uniqueData;
        this.filteredDossiers = [...this.dossiers];
        if (this.dossiers.length > 0) {
          this.selectDossier(this.dossiers[0]);
        }
        this.loading = false;
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger l\'historique' });
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

  selectDossier(dossier: any) {
    this.selectedDossier = dossier;
    this.loadingTimeline = true;
    this.validationService.getValidationStatus(dossier.id).subscribe({
      next: (data) => {
        this.buildTimeline(data);
        
        // Fallback pour le mode Simulation : si l'historique API est vide mais que le statut témoigne d'une décision
        if (this.timelineEvents.length === 0 && (dossier.status === 'NO_GO_CONFIRMED' || dossier.status === 'FORCE_GO_ENREGISTRÉ')) {
            this.timelineEvents.push({
                role: 'Manager Décisionnel (Simulation)',
                date: new Date(),
                status: dossier.status === 'NO_GO_CONFIRMED' ? 'REJECTED' : 'APPROVED',
                commentaire: 'Décision enregistrée via le mode Test/Simulation (Le jeton de validation backend est absent).'
            });
        }
        
        this.loadingTimeline = false;
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger les décisions' });
        this.timelineEvents = [];
        
        // Fallback même en cas d'erreur API
        if (dossier.status === 'NO_GO_CONFIRMED' || dossier.status === 'FORCE_GO_ENREGISTRÉ') {
            this.timelineEvents.push({
                role: 'Manager Décisionnel (Simulation)',
                date: new Date(),
                status: dossier.status === 'NO_GO_CONFIRMED' ? 'REJECTED' : 'APPROVED',
                commentaire: 'Décision enregistrée via le mode Test/Simulation.'
            });
        }
        
        this.loadingTimeline = false;
      }
    });
  }

  buildTimeline(data: any[]) {
    // Transformer les données de l'API en objets pour p-timeline
    this.timelineEvents = data.map(val => {
      let icon = 'pi pi-clock';
      let color = '#f59e0b'; // orange (PENDING)
      
      if (val.status === 'APPROVED') {
        icon = 'pi pi-check';
        color = '#10b981'; // green
      } else if (val.status === 'REJECTED') {
        icon = 'pi pi-times';
        color = '#ef4444'; // red
      }

      return {
        role: val.role,
        nom: val.nom,
        email: val.email,
        status: val.status,
        date: val.actionAt ? new Date(val.actionAt) : null,
        icon: icon,
        color: color,
        commentaire: val.commentaire
      };
    });
  }

  getScoreColor(score: number): string {
    if (!score) return 'text-500';
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-orange-500';
    return 'text-red-500';
  }
}
