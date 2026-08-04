import { Component, OnInit } from '@angular/core';
import { AdminService, RoleWithPermissions, Permission } from '../../../service/admin.service';
import { MessageService, MenuItem } from 'primeng/api';
import { forkJoin } from 'rxjs';

@Component({
    templateUrl: './roles.component.html'
})
export class RolesComponent implements OnInit {

    roles: any[] = [];
    allPermissions: Permission[] = [];
    selectedRole: any = null;
    searchTerm: string = '';

    roleMenuItems: MenuItem[] = [];
    selectedPermissionIds: string[] = [];

    loading: boolean = false;
    detailsLoading: boolean = false;
    auditLoading: boolean = false;
    saveLoading: boolean = false;
    saveSuccess: boolean = false;
    successMessages: any[] = [];

    roleAuditTrail: any[] = [];

    // Dialog duplication
    displayDuplicateDialog: boolean = false;
    newRoleName: string = '';

    constructor(private adminService: AdminService, private messageService: MessageService) { }

    ngOnInit() {
        this.initData();
        this.initRoleMenu();
    }

    // On charge TOUT en une seule fois pour éviter les décalages
    initData() {
        this.loading = true;
        forkJoin({
            roles: this.adminService.getRoles(),
            allPerms: this.adminService.getAllPermissions()
        }).subscribe({
            next: (res) => {
                this.allPermissions = res.allPerms || [];
                this.roles = res.roles || [];
                this.categorizePermissions();

                if (this.roles.length > 0) {
                    this.selectRole(this.roles[0]);
                }
                this.loading = false;
                console.log('✅ Données initialisées :', { roles: this.roles.length, permissions: this.allPermissions.length });
            },
            error: (err) => {
                this.loading = false;
                console.error('❌ Erreur initialisation :', err);
                this.messageService.add({ severity: 'error', summary: 'Erreur Serveur', detail: 'Impossible de joindre le backend' });
            }
        });
    }

    initRoleMenu() {
        this.roleMenuItems = [{
            label: 'Actions Avancées',
            items: [
                { label: 'Dupliquer le rôle', icon: 'pi pi-copy', command: () => { this.displayDuplicateDialog = true; } },
                { label: 'Exporter la config', icon: 'pi pi-download', command: () => { this.exportConfig(); } }
            ]
        }];
    }

    loadAllPermissions() {
        this.adminService.getAllPermissions().subscribe(data => {
            this.allPermissions = data || [];
            this.categorizePermissions();
        });
    }

    get filteredRoles() {
        return this.roles.filter(r =>
            r.code.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
            r.label.toLowerCase().includes(this.searchTerm.toLowerCase())
        );
    }

    selectRole(role: any) {
        this.selectedRole = role;
        this.detailsLoading = true;
        this.auditLoading = true;
        this.selectedPermissionIds = [];
        this.successMessages = [];

        this.adminService.getRolePermissions(role.id).subscribe({
            next: (data: any[]) => {
                // Mapping ultra-robuste pour éviter tout décalage d'ID
                this.selectedPermissionIds = data.map(item => {
                    const val = (typeof item === 'object' ? item.id : item).toString().toLowerCase().trim();

                    if (this.isUUID(val)) {
                        // On cherche le vrai ID dans allPermissions qui matche (insensible à la casse)
                        const match = this.allPermissions.find(p => p.id.toLowerCase().trim() === val);
                        return match ? match.id : val;
                    }

                    const found = this.allPermissions.find(p => p.code.toLowerCase().trim() === val);
                    return found ? found.id : val;
                });

                this.detailsLoading = false;
                this.loadRoleAudit(role);
                console.log(`✅ ${this.selectedPermissionIds.length} permissions cochées pour ${role.label}`);
            },
            error: () => {
                this.detailsLoading = false;
                this.auditLoading = false;
            }
        });
    }

    private isUUID(str: string): boolean {
        const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return typeof str === 'string' && regex.test(str);
    }

    savePermissions() {
        if (!this.selectedRole) return;
        this.saveLoading = true;
        this.saveSuccess = false;
        this.successMessages = [];

        this.adminService.updateRolePermissions(this.selectedRole.id, this.selectedPermissionIds).subscribe({
            next: () => {
                this.saveLoading = false;
                this.saveSuccess = true;
                this.successMessages = [{
                    severity: 'success',
                    summary: 'Confirmation de Sécurité',
                    detail: `Les privilèges du rôle ${this.selectedRole.label} ont été synchronisés avec succès.`
                }];
                this.loadRoleAudit(this.selectedRole);
                setTimeout(() => this.saveSuccess = false, 3000);
            },
            error: () => {
                this.saveLoading = false;
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'La mise à jour en base a échoué.' });
            }
        });
    }

    categorized: any = { intelligence: [], governance: [], admin: [] };

    categorizePermissions() {
        this.categorized = { intelligence: [], governance: [], admin: [] };
        this.allPermissions.forEach((p: Permission) => {
            const cat = p.category || '';
            if (cat === 'Intelligence Documentaire') this.categorized.intelligence.push(p);
            else if (cat === 'Gouvernance & Verdict') this.categorized.governance.push(p);
            else this.categorized.admin.push(p);
        });
    }

    selectAllPermissions() {
        this.selectedPermissionIds = this.allPermissions.map(p => p.id);
    }

    deselectAllPermissions() {
        this.selectedPermissionIds = [];
    }

    loadRoleAudit(role: any) {
        this.adminService.getAuditEvents({ entity: 'ROLE', action: role.code }).subscribe({
            next: (data) => {
                this.roleAuditTrail = data.content || [];
                this.auditLoading = false;
            },
            error: () => {
                this.roleAuditTrail = [];
                this.auditLoading = false;
            }
        });
    }

    // Formater les actions techniques en texte métier
    formatAction(action: string): string {
        switch (action) {
            case 'UPDATE_PERMISSIONS': return 'Mise à jour des privilèges';
            case 'TOGGLE_STATUS': return 'Modification de la disponibilité';
            case 'DUPLICATE_ROLE': return 'Duplication du profil';
            default: return action;
        }
    }

    // Mapper les IDs acteurs en noms lisibles (selon les privilèges de la base)
    getActorName(actorId: string): string {
        // Cet ID correspond à l'administrateur système dans votre UserService.java
        if (actorId === '11111111-1111-1111-1111-111111111111') return 'Administrateur';
        return 'Utilisateur';
    }

    onStatusChange() {
        this.messageService.add({ severity: 'success', summary: 'Statut mis à jour', detail: 'Le profil a été modifié avec succès.' });
    }

    confirmDuplicate(): void {
        if (!this.newRoleName.trim() || !this.selectedRole) return;
        
        this.adminService.duplicateRole(this.selectedRole.id, this.newRoleName).subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Succès', detail: `Le rôle a été dupliqué.` });
                this.displayDuplicateDialog = false;
                this.newRoleName = '';
                this.initData(); // Recharger la liste
            },
            error: () => {
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Échec de la duplication.' });
            }
        });
    }

    exportConfig(): void {
        this.adminService.exportRolesConfig().subscribe({
            next: (blob: Blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'security_roles_config.json';
                a.click();
                window.URL.revokeObjectURL(url);
                this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Configuration exportée.' });
            },
            error: () => {
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Échec de l\'exportation.' });
            }
        });
    }
}
