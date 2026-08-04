import { Component, OnInit } from '@angular/core';
import { AdminService, UserResponse } from '../../../service/admin.service';
import { MessageService } from 'primeng/api';

@Component({
    templateUrl: './profile.component.html'
})
export class ProfileComponent implements OnInit {

    user: UserResponse | null = null;
    newName: string = '';
    loading: boolean = false;

    constructor(private adminService: AdminService, private messageService: MessageService) { }

    ngOnInit() {
        this.loadProfile();
    }

    loadProfile() {
        this.adminService.getProfile().subscribe({
            next: (data) => {
                this.user = data;
                this.newName = data.fullName;
                if (data.fullName) {
                    localStorage.setItem('userName', data.fullName);
                }
            },
            error: (err) => {
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
                localStorage.setItem('userName', data.fullName); // Assurance de la modif
                this.loading = false;
                this.messageService.add({ severity: 'success', summary: 'Profil actualisé', detail: `Bonjour ${data.fullName}, vos modifications sont actives.` });
            },
            error: (err) => {
                this.loading = false;
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Échec de la mise à jour' });
            }
        });
    }
}
