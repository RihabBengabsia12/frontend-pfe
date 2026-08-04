import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ManagerValidationService } from '../../../service/manager-validation.service';

@Component({
  selector: 'app-manager-historique-nogo',
  templateUrl: './manager-historique-nogo.component.html',
  styleUrls: ['./manager-historique-nogo.component.scss'],
  providers: [MessageService]
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

  constructor(
    private validationService: ManagerValidationService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.loadNoGoHistory();
  }

  loadNoGoHistory() {
    this.loading = true;
    this.validationService.getDossiersWithNoGo().subscribe({
      next: (data) => {
        this.dossiers = data;
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
    setTimeout(() => {
        this.loadingPreview = false;
        // Dans une vraie application, on utiliserait docx-preview ici
        // avec l'URL : environment.minioUrl + dossier.nogoReportPath
    }, 1500);
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
