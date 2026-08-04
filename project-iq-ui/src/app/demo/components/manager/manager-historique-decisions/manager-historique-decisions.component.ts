import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ManagerValidationService } from '../../../service/manager-validation.service';

@Component({
  selector: 'app-manager-historique-decisions',
  templateUrl: './manager-historique-decisions.component.html',
  styleUrls: ['./manager-historique-decisions.component.scss'],
  providers: [MessageService]
})
export class ManagerHistoriqueDecisionsComponent implements OnInit {

  dossiers: any[] = [];
  filteredDossiers: any[] = [];
  loading: boolean = true;
  searchTerm: string = '';

  selectedDossier: any = null;
  timelineEvents: any[] = [];
  loadingTimeline: boolean = false;

  constructor(
    private validationService: ManagerValidationService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.loadDossiers();
  }

  loadDossiers() {
    this.loading = true;
    this.validationService.getDossiersWithDecisions().subscribe({
      next: (data) => {
        this.dossiers = data;
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
        this.loadingTimeline = false;
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger les décisions' });
        this.timelineEvents = [];
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
