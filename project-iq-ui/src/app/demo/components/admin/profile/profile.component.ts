import { Component, OnInit } from '@angular/core';
import { AdminService, UserResponse } from '../../../service/admin.service';
import { AuthService } from '../../../service/auth.service';
import { MessageService } from 'primeng/api';

@Component({
    templateUrl: './profile.component.html'
})
export class ProfileComponent implements OnInit {

    user: UserResponse | null = null;
    newName: string = '';
    loading: boolean = false;
    passwordDialogVisible: boolean = false;
    currentPassword: string = '';
    newPassword: string = '';
    confirmPassword: string = '';
    passwordLoading: boolean = false;
    profileLoadError: boolean = false;

    constructor(
        private adminService: AdminService,
        private authService: AuthService,
        private messageService: MessageService
    ) { }

    ngOnInit() {
        this.loadProfile();
    }

    loadProfile() {
        this.adminService.getProfile().subscribe({
            next: (data) => {
                this.user = data;
                this.profileLoadError = false;
                this.newName = data.fullName;
                if (data.fullName) {
                    sessionStorage.setItem('userName', data.fullName);
                }
            },
            error: (err) => {
                this.profileLoadError = true;
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger le profil' });
            }
        });
    }

    getRoleLabel(role: string): string {
        const roleUpper = (role || '').toUpperCase();
        const labels: any = {
            'ADMIN': 'Administrateur Supérieur',
            'ANALYST': 'Analyste Expert',
            'MANAGER': 'Responsable Gestion',
            'GUEST': 'Administrateur Principal'
        };
        
        // Si c'est l'admin qui gère tout, on affiche un titre prestigieux
        return labels[roleUpper] || 'Administrateur Supérieur';
    }

    updateProfile() {
        if (!this.newName.trim()) return;
        
        this.loading = true;
        this.adminService.updateProfile({ fullName: this.newName }).subscribe({
            next: (data) => {
                this.user = data;
                sessionStorage.setItem('userName', data.fullName); // Assurance de la modif
                this.loading = false;
                this.messageService.add({ severity: 'success', summary: 'Profil actualisé', detail: `Bonjour ${data.fullName}, vos modifications sont actives.` });
            },
            error: (err) => {
                this.loading = false;
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Échec de la mise à jour' });
            }
        });
    }

    openPasswordDialog(): void {
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.passwordDialogVisible = true;
    }

    changePassword(): void {
        if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
            this.messageService.add({ severity: 'warn', summary: 'Champs requis', detail: 'Renseignez les trois champs.' });
            return;
        }
        if (this.newPassword !== this.confirmPassword) {
            this.messageService.add({ severity: 'warn', summary: 'Confirmation incorrecte', detail: 'Les deux nouveaux mots de passe sont différents.' });
            return;
        }
        if (this.newPassword.length < 8) {
            this.messageService.add({ severity: 'warn', summary: 'Mot de passe insuffisant', detail: 'Utilisez au moins 8 caractères.' });
            return;
        }
        this.passwordLoading = true;
        this.authService.changePassword({ oldPassword: this.currentPassword, newPassword: this.newPassword }).subscribe({
            next: () => {
                this.passwordLoading = false;
                this.passwordDialogVisible = false;
                this.messageService.add({ severity: 'success', summary: 'Mot de passe modifié', detail: 'Votre nouveau mot de passe est actif.' });
            },
            error: (error) => {
                this.passwordLoading = false;
                this.messageService.add({ severity: 'error', summary: 'Modification refusée', detail: error?.error?.message || error?.error?.detail || 'Vérifiez votre mot de passe actuel.' });
            }
        });
    }
}
