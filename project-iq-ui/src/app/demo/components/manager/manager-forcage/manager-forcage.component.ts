import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ManagerValidationService } from '../../../service/manager-validation.service';

@Component({
  selector: 'app-manager-forcage',
  templateUrl: './manager-forcage.component.html',
  styleUrls: ['./manager-forcage.component.scss'],
  providers: []
})
export class ManagerForcageComponent implements OnInit {

  pendingDossiers: any[] = [];
  selectedDossier: any = null;
  loading: boolean = true;
  actionLoading: boolean = false;
  showAuditButton: boolean = false;
  showNoGoReportButton: boolean = false;

  forceDialogVisible: boolean = false;
  forceGoForm = { justification: '', type: 'STRATEGIQUE', forcedBy: 'Manager' }; // we can get actual username later if needed
  forceGoTypes = [
    { label: 'Stratégique', value: 'STRATEGIQUE' },
    { label: 'Partenariat à consolider', value: 'PARTENARIAT_A_CONSOLIDER' },
    { label: 'Client prioritaire', value: 'CLIENT_PRIORITAIRE' },
    { label: 'Autre', value: 'AUTRE' }
  ];

  constructor(
    private validationService: ManagerValidationService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.loadPendingNoGo();
    this.forceGoForm.forcedBy = sessionStorage.getItem('userEmail') || 'Manager'; 
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
    this.showAuditButton = false;
    this.showNoGoReportButton = false;
  }

  openForceGoDialog() {
    this.forceGoForm.justification = '';
    this.forceGoForm.type = 'STRATEGIQUE';
    this.forceDialogVisible = true;
  }

  confirmForceGo() {
    if (!this.forceGoForm.justification || this.forceGoForm.justification.trim().split(/\s+/).length < 50) {
        this.messageService.add({ severity: 'warn', summary: 'Attention', detail: 'La justification doit contenir au moins 50 mots.' });
        return;
    }

    this.forceDialogVisible = false;
    this.actionLoading = true;
    
    const request = {
      decision: 'FORCE_GO',
      justification: this.forceGoForm.justification,
      typeForcage: this.forceGoForm.type,
      managerName: sessionStorage.getItem('userEmail') || 'Manager'
    };

    this.validationService.processNoGoDecision(this.selectedDossier.id, request).subscribe({
      next: (res) => {
        this.messageService.add({ severity: 'success', summary: 'Décision Enregistrée', detail: 'Go Forcé avec succès !' });
        this.actionLoading = false;
        
        this.showNoGoReportButton = true;
        
        // Mettre à jour le statut localement sans recharger la liste pour le garder visible et grisé
        const newStatus = res.status || 'FORCE_GO_ENREGISTRÉ';
        this.selectedDossier.status = newStatus;
        const index = this.pendingDossiers.findIndex(d => d.id === this.selectedDossier.id);
        if (index !== -1) {
            this.pendingDossiers[index].status = newStatus;
        }
      },
      error: (err) => {
        const errorMsg = err.error?.message || 'Erreur lors du forçage';
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: errorMsg });
        this.actionLoading = false;
      }
    });
  }

  processDecision(decision: 'VALIDATE_NOGO' | 'FORCE_GO') {
    if (decision === 'FORCE_GO') {
        this.openForceGoDialog();
        return;
    }

    this.actionLoading = true;
    const request = {
      decision: 'VALIDATE_NOGO',
      justification: '',
      typeForcage: '',
      managerName: sessionStorage.getItem('userEmail') || 'Manager'
    };

    this.validationService.processNoGoDecision(this.selectedDossier.id, request).subscribe({
      next: (res) => {
        const msg = 'No-Go Validé';
        this.messageService.add({ severity: 'success', summary: 'Décision Enregistrée', detail: msg });
        this.actionLoading = false;
        
        // Afficher le bouton de génération du rapport d'audit
        this.showAuditButton = true;
        
        // Mettre à jour le statut localement
        const newStatus = 'NO_GO_CONFIRMED';
        this.selectedDossier.status = newStatus;
        const index = this.pendingDossiers.findIndex(d => d.id === this.selectedDossier.id);
        if (index !== -1) {
            this.pendingDossiers[index].status = newStatus;
        }
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Erreur lors du traitement' });
        this.actionLoading = false;
      }
    });
  }

  downloadNoGoReport() {
      if (this.selectedDossier && this.selectedDossier.id) {
          window.open(`/api/dossiers/${this.selectedDossier.id}/download/nogo/blob`, '_blank');
      }
  }

  archiveAndAudit() {
    this.actionLoading = true;
    this.validationService.archiveAndAudit(this.selectedDossier.id).subscribe({
      next: (res) => {
          const msg = 'Dossier archivé et Rapport Audit généré avec succès.';
          this.messageService.add({ severity: 'success', summary: 'Opération réussie', detail: msg });
          this.actionLoading = false;
          
          // Mettre à jour le statut localement pour qu'il reste grisé
          this.selectedDossier.status = 'ARCHIVED';
          const index = this.pendingDossiers.findIndex(d => d.id === this.selectedDossier.id);
          if (index !== -1) {
              this.pendingDossiers[index].status = 'ARCHIVED';
          }
        },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Erreur lors de l\'archivage et de la génération' });
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
