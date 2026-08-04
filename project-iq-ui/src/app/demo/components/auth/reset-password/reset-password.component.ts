import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from 'src/app/demo/service/auth.service';
import { MessageService } from 'primeng/api';

@Component({
    selector: 'app-reset-password',
    templateUrl: './reset-password.component.html',
    providers: [MessageService]
})
export class ResetPasswordComponent implements OnInit {

    token: string = '';
    newPassword: string = '';
    confirmPassword: string = '';
    isLoading: boolean = false;
    isSuccess: boolean = false;

    constructor(
        private route: ActivatedRoute,
        private authService: AuthService,
        private messageService: MessageService,
        private router: Router
    ) { }

    ngOnInit(): void {
        // Extraction du token depuis l'URL (?token=...)
        this.route.queryParams.subscribe(params => {
            this.token = params['token'];
            console.log('Token détecté :', this.token);
            
            if (!this.token) {
                this.messageService.add({ 
                    severity: 'warn', 
                    summary: 'Attention', 
                    detail: 'Aucun token de sécurité trouvé dans le lien.' 
                });
            }
        });
    }

    onReset(): void {
        if (!this.token) {
            this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Token invalide ou expiré.' });
            return;
        }

        if (this.newPassword !== this.confirmPassword) {
            this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Les mots de passe ne correspondent pas.' });
            return;
        }

        if (this.newPassword.length < 6) {
            this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Le mot de passe doit faire au moins 6 caractères.' });
            return;
        }

        this.isLoading = true;
        this.authService.resetPasswordPublic(this.token, this.newPassword).subscribe({
            next: (res) => {
                this.isLoading = false;
                this.isSuccess = true;
                this.messageService.add({ 
                    severity: 'success', 
                    summary: 'Réussite', 
                    detail: 'Votre mot de passe a été réinitialisé avec succès.' 
                });
                // Redirection vers le login après 3 secondes
                setTimeout(() => {
                    this.router.navigate(['/auth/login']);
                }, 3000);
            },
            error: (err) => {
                this.isLoading = false;
                this.messageService.add({ 
                    severity: 'error', 
                    summary: 'Échec', 
                    detail: err.error?.message || 'Une erreur est survenue lors de la réinitialisation.' 
                });
            }
        });
    }
}
