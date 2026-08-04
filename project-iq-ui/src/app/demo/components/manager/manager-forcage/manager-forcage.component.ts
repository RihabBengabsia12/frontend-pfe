import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ManagerValidationService } from '../../../service/manager-validation.service';

@Component({
  selector: 'app-manager-forcage',
  templateUrl: './manager-forcage.component.html',
  styleUrls: ['./manager-forcage.component.scss'],
  providers: [MessageService]
})
export class ManagerForcageComponent implements OnInit {

  pendingDossiers: any[] = [];
  selectedDossier: any = null;
  loading: boolean = true;
  actionLoading: boolean = false;

  constructor(
    private validationService: ManagerValidationService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.loadPendingNoGo();
  }

  loadPendingNoGo() {
    this.loading = true;
    this.validationService.getPendingNoGoDossiers().subscribe({
      next: (data) => {
        this.pendingDossiers = data;
        if (this.pendingDossiers.length > 0) {
          this.selectDossier(this.pendingDossiers[0]);
        } else {
          this.selectedDossier = null;
        }
        this.loading = false;
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger les dossiers' });
        this.loading = false;
      }
    });
  }

  selectDossier(dossier: any) {
    this.selectedDossier = dossier;
  }

  processDecision(status: 'ARCHIVED' | 'FORCE_GO') {
    this.actionLoading = true;
    this.validationService.updateDossierStatus(this.selectedDossier.id, status).subscribe({
      next: (res) => {
        const msg = status === 'ARCHIVED' ? 'No-Go Confirmé et dossier archivé' : 'Go Forcé avec succès !';
        this.messageService.add({ severity: 'success', summary: 'Décision Enregistrée', detail: msg });
        this.actionLoading = false;
        this.loadPendingNoGo(); // Recharger la liste
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Erreur lors du traitement' });
        this.actionLoading = false;
      }
    });
  }

  getScoreColor(score: number): string {
    if (!score) return 'text-500';
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-orange-500';
    return 'text-red-500';
  }
}
