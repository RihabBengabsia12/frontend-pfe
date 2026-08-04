import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ManagerValidationService } from '../../../service/manager-validation.service';

@Component({
  selector: 'app-manager-validations',
  templateUrl: './manager-validations.component.html',
  styleUrls: ['./manager-validations.component.scss'],
  providers: [MessageService]
})
export class ManagerValidationsComponent implements OnInit {

  pendingValidations: any[] = [];
  selectedValidation: any = null;
  loading: boolean = true;
  actionLoading: boolean = false;
  commentaire: string = '';

  // Simulation : En temps réel, ceci viendrait de AuthService (le token JWT)
  // L'utilisateur a précisé que les 4 comptes sont actifs. On prend "dga@st2i.tn" pour la démo,
  // ou on peut faire un sélecteur rapide pour tester tous les rôles.
  currentEmail: string = 'dga@st2i.tn'; 

  constructor(
    private validationService: ManagerValidationService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.loadPendingValidations();
  }

  loadPendingValidations() {
    this.loading = true;
    this.validationService.getPendingValidations(this.currentEmail).subscribe({
      next: (data) => {
        this.pendingValidations = data;
        if (this.pendingValidations.length > 0) {
          this.selectValidation(this.pendingValidations[0]);
        } else {
          this.selectedValidation = null;
        }
        this.loading = false;
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger vos tâches' });
        this.loading = false;
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
        this.loadPendingValidations(); // Recharger la liste
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
