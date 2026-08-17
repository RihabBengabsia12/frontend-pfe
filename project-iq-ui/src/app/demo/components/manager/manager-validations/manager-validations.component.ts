import { Component, OnDestroy, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ManagerValidationService } from '../../../service/manager-validation.service';
import { NotificationStateService } from '../../../service/notification-state.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-manager-validations',
  templateUrl: './manager-validations.component.html',
  styleUrls: ['./manager-validations.component.scss'],
  providers: []
})
export class ManagerValidationsComponent implements OnInit, OnDestroy {

  pendingValidations: any[] = [];
  selectedValidation: any = null;
  loading: boolean = true;
  actionLoading: boolean = false;
  commentaire: string = '';
  auditLoading: boolean = false;
  auditDialogVisible = false;
  auditCompletedDossier: any = null;
  auditGenerationCompleted = false;
  private refreshTimer?: ReturnType<typeof setInterval>;
  private auditPollTimer?: ReturnType<typeof setInterval>;

  // On récupère l'email depuis le sessionStorage s'il existe, sinon on fallback
  currentEmail: string = sessionStorage.getItem('userEmail') || 'dga@st2i.tn';

  constructor(
    private validationService: ManagerValidationService,
    private messageService: MessageService,
    private notificationService: NotificationStateService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadPendingValidations();
    // Une décision prise dans l'e-mail apparaît sans rechargement manuel.
    this.refreshTimer = setInterval(() => this.loadPendingValidations(false), 10000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    if (this.auditPollTimer) clearInterval(this.auditPollTimer);
  }

  loadPendingValidations(showSpinner = true) {
    if (showSpinner) this.loading = true;
    this.validationService.getPendingValidations(this.currentEmail).subscribe({
      next: (data) => {
        this.pendingValidations = data;
        if (this.pendingValidations.length > 0) {
          const refreshedSelection = this.selectedValidation
            ? this.pendingValidations.find(v => v.dossierId === this.selectedValidation.dossierId)
            : null;
          this.selectedValidation = refreshedSelection || this.pendingValidations[0];
        } else {
          this.selectedValidation = null;
        }
        if (showSpinner) this.loading = false;
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger vos tâches' });
        if (showSpinner) this.loading = false;
      }
    });
  }

  selectValidation(val: any) {
    this.selectedValidation = val;
    this.commentaire = '';
  }

  processDecision(action: 'APPROVED' | 'REJECTED') {
    if (action === 'REJECTED' && !this.commentaire.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Attention', detail: 'Un commentaire est obligatoire pour un refus' });
      return;
    }

    this.actionLoading = true;
    this.validationService.processAction(this.selectedValidation.token, action, this.commentaire).subscribe({
      next: (res) => {
        this.messageService.add({ severity: 'success', summary: 'Succès', detail: `Dossier ${action === 'APPROVED' ? 'Approuvé' : 'Rejeté'} avec succès` });
        this.actionLoading = false;
        
        // Simuler la notification envoyée à l'analyste
        this.notificationService.addBellNotification({
            title: `Décision Managériale : ${action === 'APPROVED' ? 'GO' : 'NO-GO'}`,
            message: `Le Manager a ${action === 'APPROVED' ? 'approuvé' : 'rejeté'} le dossier. ${action === 'REJECTED' ? 'Raison : ' + this.commentaire : ''}`,
            type: action === 'APPROVED' ? 'success' : 'error'
        });

        this.loadPendingValidations(); // Recharger la liste
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Erreur lors du traitement' });
        this.actionLoading = false;
      }
    });
  }

  generateAudit() {
    if (!this.selectedValidation?.showGenerateAudit) return;
    this.auditLoading = true;
    this.validationService.generateFinalAudit(this.selectedValidation.dossierId).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Audit lancé', detail: 'Le rapport d’audit est en cours de génération. Le dossier sera archivé une fois le rapport reçu.' });
        this.auditLoading = false;
        this.auditDialogVisible = true;
        this.auditGenerationCompleted = false;
        this.watchAuditGeneration(this.selectedValidation.dossierId);
        this.loadPendingValidations();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: err.error?.message || 'Impossible de générer le rapport d’audit.' });
        this.auditLoading = false;
      }
    });
  }

  retryAudit() {
    if (!this.selectedValidation?.dossierId) return;
    this.auditLoading = true;
    this.validationService.generateFinalAudit(this.selectedValidation.dossierId).subscribe({
      next: () => {
        this.auditLoading = false;
        this.auditDialogVisible = true;
        this.auditGenerationCompleted = false;
        this.watchAuditGeneration(this.selectedValidation.dossierId);
      },
      error: (err) => {
        this.auditLoading = false;
        this.messageService.add({ severity: 'error', summary: 'Relance impossible', detail: err.error?.message || 'Le lancement de l’audit a échoué.' });
      }
    });
  }

  downloadPack() {
    if (!this.selectedValidation?.packZipPath) {
      this.messageService.add({ severity: 'warn', summary: 'Pack indisponible', detail: 'Le ZIP n’est pas encore disponible.' });
      return;
    }
    this.downloadDocument(this.selectedValidation.dossierId, 'pack');
  }

  downloadAudit() {
    if (!this.auditCompletedDossier?.id) return;
    this.auditDialogVisible = false;
    this.router.navigate(['/manager/audit-consultation'], {
      queryParams: { dossierId: this.auditCompletedDossier.id }
    });
  }

  private downloadDocument(dossierId: string, type: 'pack' | 'audit') {
    this.validationService.downloadDocument(dossierId, type).subscribe({
      next: (content) => {
        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = type === 'pack' ? 'Pack_Soumission.zip' : 'Rapport_Audit.docx';
        link.click();
        URL.revokeObjectURL(url);
      },
      error: (err) => this.messageService.add({ severity: 'error', summary: 'Téléchargement impossible', detail: err.error?.message || 'Le document demandé est indisponible.' })
    });
  }

  private watchAuditGeneration(dossierId: string) {
    if (this.auditPollTimer) clearInterval(this.auditPollTimer);
    const check = () => this.validationService.getDossiersWithPacks().subscribe({
      next: (dossiers) => {
        const dossier = dossiers.find(d => d.id === dossierId);
        if (dossier?.auditReportPath) {
          if (this.auditPollTimer) clearInterval(this.auditPollTimer);
          this.auditPollTimer = undefined;
          this.auditCompletedDossier = dossier;
          this.auditGenerationCompleted = true;
          this.loadPendingValidations(false);
        }
      }
    });
    check();
    this.auditPollTimer = setInterval(check, 5000);
  }

  isEmailDecision(val: any): boolean {
    const decisions = val?.decisions || [];
    return decisions.length > 0 && decisions.every((decision: any) => decision.source === 'EMAIL');
  }

  isPlatformDecision(val: any): boolean {
    const decisions = val?.decisions || [];
    return decisions.length > 0 && decisions.every((decision: any) => decision.source !== 'EMAIL');
  }

  getDecisionSourceLabel(val: any): string {
    if (this.isEmailDecision(val)) return 'Décision prise par e-mail';
    if (this.isPlatformDecision(val)) return 'Décision prise sur la plateforme';
    return 'Décisions e-mail et plateforme';
  }

  isGenericEmailComment(comment: string): boolean {
    return (comment || '').trim() === 'Décision prise via le lien sécurisé envoyé par e-mail.';
  }

  isDecisionTaken(val: any): boolean {
    return val?.decisionSummary === 'GO_CONFIRMED' || val?.decisionSummary === 'NO_GO_CONFIRMED';
  }

  getDecisionLabel(val: any): string {
    if (val?.decisionSummary === 'GO_CONFIRMED') return 'GO approuvé par tous';
    if (val?.decisionSummary === 'NO_GO_CONFIRMED') return 'NO-GO confirmé';
    if (val?.decisionStatus === 'APPROVED') return 'GO approuvé';
    if (val?.decisionStatus === 'FORCE_GO') return 'GO forcé';
    if (val?.decisionStatus === 'APPROVE_NOGO') return 'NO-GO confirmé';
    return 'NO-GO rejeté';
  }

  getDecisionSeverity(val: any): 'success' | 'danger' | 'warning' {
    if (val?.decisionSummary === 'GO_CONFIRMED') return 'success';
    if (val?.decisionSummary === 'NO_GO_CONFIRMED') return 'warning';
    if (['APPROVED', 'FORCE_GO'].includes(val?.decisionStatus)) return 'success';
    if (val?.decisionStatus === 'APPROVE_NOGO') return 'warning';
    return 'danger';
  }

  getScoreColor(score: number): string {
    if (!score) return 'text-500';
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-orange-500';
    return 'text-red-500';
  }
}
