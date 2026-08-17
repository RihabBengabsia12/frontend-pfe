import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ManagerValidationService } from 'src/app/demo/service/manager-validation.service';
import { MessageService } from 'primeng/api';
import { NotificationStateService } from 'src/app/demo/service/notification-state.service';

@Component({
    selector: 'app-email-validation',
    templateUrl: './email-validation.component.html'
})
export class EmailValidationComponent implements OnInit {

    token: string = '';
    action: string = '';
    isLoading: boolean = false;
    isSuccess: boolean = false;
    message: string = '';
    showJustificationForm: boolean = false;
    justification: string = '';

    constructor(
        private route: ActivatedRoute,
        private validationService: ManagerValidationService,
        private messageService: MessageService,
        private router: Router,
        private notificationService: NotificationStateService
    ) { }

    ngOnInit(): void {
        this.token = this.route.snapshot.paramMap.get('token') || '';
        this.action = this.route.snapshot.queryParamMap.get('action') || '';
        
        if (!this.token || !this.action) {
            this.message = "Lien invalide ou expiré.";
            this.isSuccess = false;
            return;
        }

        if (this.action === 'REJECTED' || this.action === 'APPROVE_NOGO') {
            this.showJustificationForm = true;
        } else {
            this.processValidation();
        }
    }

    submitJustification() {
        if (!this.justification || this.justification.trim().length < 10) {
            this.messageService.add({ severity: 'warn', summary: 'Attention', detail: 'Veuillez saisir une justification d\'au moins 10 caractères.' });
            return;
        }
        this.showJustificationForm = false;
        this.processValidation();
    }

    processValidation() {
        this.isLoading = true;
        this.validationService.processAction(this.token, this.action, this.justification, 'EMAIL').subscribe({
            next: (res) => {
                this.isLoading = false;
                this.isSuccess = true;
                this.message = res.message || "Votre décision a été enregistrée avec succès.";
                this.messageService.add({ severity: 'success', summary: 'Succès', detail: this.message });
                
                // Simuler la notification envoyée à l'analyste
                this.notificationService.addBellNotification({
                    title: `Décision Managériale : ${this.action.includes('APPROVE') ? 'GO' : 'NO-GO'}`,
                    message: `Le Manager a ${this.action.includes('APPROVE') ? 'approuvé' : 'rejeté'} le dossier depuis son email. ${this.action.includes('REJECT') ? 'Raison : ' + this.justification : ''}`,
                    type: this.action.includes('APPROVE') ? 'success' : 'error'
                });

                // Le manager peut ouvrir ce lien sans session. On conserve donc la
                // confirmation à l'écran au lieu de le rediriger vers la connexion.
            },
            error: (err) => {
                this.isLoading = false;
                this.isSuccess = false;
                this.message = err.error?.message || "Une erreur est survenue. Le lien est peut-être expiré.";
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: this.message });
            }
        });
    }
}
