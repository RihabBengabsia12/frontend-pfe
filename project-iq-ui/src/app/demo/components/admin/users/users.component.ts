import { Component, OnInit } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AdminService, UserResponse } from 'src/app/demo/service/admin.service';
import { AuthService } from 'src/app/demo/service/auth.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
    selector: 'app-users',
    templateUrl: './users.component.html'
})
export class UsersComponent implements OnInit {

    users: UserResponse[] = [];
    totalRecords = 0;
    rows = 10;
    isLoading = false;

    displayDetail: boolean = false;
    selectedUserDetails: UserResponse | null = null;

    // Filtres
    selectedLetter: string = '';
    alphabet: string[] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    displayedUsers: UserResponse[] = [];

    // Feature Flags
    displayFeatures: boolean = false;
    selectedUserForFeatures: UserResponse | null = null;
    userFeatures: { [key: string]: boolean } = {
        'ESPACE_ANALYSTE': true,
        'LIVRABLES': true,
        'LOGS_IA': true
    };

    constructor(
        private adminService: AdminService,
        private authService: AuthService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) {}

    ngOnInit(): void {
        this.loadUsers(0);
    }

    setFilterLetter(letter: string): void {
        this.selectedLetter = this.selectedLetter === letter ? '' : letter;
        this.applyAlphabetFilter();
    }

    applyAlphabetFilter(): void {
        if (!this.selectedLetter) {
            this.displayedUsers = [...this.users];
        } else {
            this.displayedUsers = this.users.filter(u => u.fullName && u.fullName.toUpperCase().startsWith(this.selectedLetter));
        }
    }

    exportPdf(): void {
        const doc = new jsPDF();
        
        // Titre
        doc.setFontSize(18);
        doc.setTextColor(40);
        doc.text('Annuaire des Utilisateurs', 14, 22);
        
        // Sous-titre
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Généré le : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 14, 30);

        const head = [['Nom complet', 'Email', 'Rôle', 'Statut', 'Date']];
        const data = this.displayedUsers.map(u => [
            u.fullName || 'N/A',
            u.email || 'N/A',
            u.role || 'GUEST',
            this.getStatusLabel(u.status || 'PENDING'),
            u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : 'N/A'
        ]);

        autoTable(doc, {
            head: head,
            body: data,
            startY: 35,
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 4 },
            headStyles: { fillColor: [34, 197, 94], textColor: 255 }, // Vert de votre thème
            alternateRowStyles: { fillColor: [248, 250, 252] },
            margin: { top: 35 }
        });

        doc.save('annuaire_utilisateurs.pdf');
    }

    loadUsers(page: number): void {
        this.isLoading = true;

        forkJoin({
            adminRes: this.adminService.getUsers(page, 100).pipe(
                catchError(err => {
                    console.error('[ANNUAIRE] Admin-service indisponible:', err.status);
                    return of({ content: [], totalElements: 0 } as any);
                })
            ),
            authRes: this.authService.getAccounts(0, 1000).pipe(
                catchError(err => {
                    console.error('[ANNUAIRE] Auth-service (accounts) error:', err);
                    if (err.error) console.error('[ANNUAIRE] Auth-service error body:', err.error);
                    return of({ content: [] } as any);
                })
            )
        }).subscribe(({ adminRes, authRes }) => {
            const adminList: UserResponse[] = adminRes?.content || [];
            const authList: any[] = authRes?.content || (Array.isArray(authRes) ? authRes : []);

            // Fusionner par EMAIL
            const userMap = new Map<string, UserResponse>();
            
            // 1. On remplit avec Admin-Service
            for (const u of adminList) {
                const email = (u.email || '').toLowerCase().trim();
                if (!email) continue;
                userMap.set(email, u);
            }

            // 2. On complète avec Auth-Service ET on écrase si le statut est REJECTED
            for (const au of authList) {
                const email = (au.email || '').toLowerCase().trim();
                if (!email) continue;

                // Récupération de l'ID le plus probable
                const authId = au.id || au.userId || au.uuid || au.authId;
                if (!authId) {
                    console.warn(`[DEBUG ANNUAIRE] L'utilisateur ${email} n'a aucun ID exploitable dans auth-service`, au);
                    continue;
                }

                const authStatus = (au.accountStatus || au.status || '').toUpperCase();
                const rejectedEmails = JSON.parse(localStorage.getItem('rejectedEmails') || '[]');
                
                if (userMap.has(email)) {
                    const existing = userMap.get(email)!;
                    (existing as any).authId = authId;
                    (existing as any).isAuthOnly = false;

                    // AUTO-SYNC BLINDÉ : Priorité absolue au Buffer ou à l'Admin si différent de GUEST
                    const pendingRoles = JSON.parse(localStorage.getItem('pendingRoles') || '{}');
                    const bufferedRole = pendingRoles[email];

                    if (bufferedRole) {
                        existing.role = bufferedRole;
                    } else if (existing.role === 'GUEST' && au.role && au.role !== 'GUEST') {
                        existing.role = au.role;
                    }

                    if (authStatus === 'REJECTED' || authStatus === 'REFUSED' || rejectedEmails.includes(email)) {
                        existing.status = 'REJECTED';
                        existing.accountStatus = 'REJECTED';
                    }
                } else {
                    const pendingRoles = JSON.parse(localStorage.getItem('pendingRoles') || '{}');
                    const bufferedRole = pendingRoles[email];

                    // Nouveau compte (pas encore dans Admin-Service)
                    userMap.set(email, {
                        id: authId,
                        email: au.email,
                        fullName: au.fullName || au.username || email.split('@')[0],
                        role: bufferedRole || au.role || 'GUEST',
                        status: authStatus === 'REFUSED' ? 'REJECTED' : (authStatus || 'PENDING'),
                        accountStatus: authStatus === 'REFUSED' ? 'REJECTED' : authStatus,
                        createdAt: au.createdAt,
                        authId: authId,
                        isAuthOnly: true
                    } as any);
                }
            }

            const allValues = Array.from(userMap.values());
            const rejectedEmails = JSON.parse(localStorage.getItem('rejectedEmails') || '[]');
            
            for (const user of allValues) {
                if (user.email && rejectedEmails.includes(user.email.toLowerCase().trim())) {
                    user.status = 'REJECTED';
                    user.accountStatus = 'REJECTED';
                }
            }

            const adminEmail = (localStorage.getItem('userEmail') || '').toLowerCase();
            this.users = allValues.filter(u => {
                const email = (u.email || '').toLowerCase();
                const isSystemAdmin = email === 'admin@st2i.tn' || email === 'admin@projectiq.com' || email === adminEmail;
                return !isSystemAdmin;
            });

            // Priorité affichage : le nouvel utilisateur (email = pendingEmail) doit remonter en premier,
            // puis les autres triés par createdAt décroissant.
            const justRegisteredEmail = (localStorage.getItem('pendingEmail') || '').toLowerCase().trim();
            this.users.sort((a: UserResponse, b: UserResponse) => {
                const emailA = (a.email || '').toLowerCase().trim();
                const emailB = (b.email || '').toLowerCase().trim();

                if (justRegisteredEmail) {
                    const aIsJust = emailA === justRegisteredEmail;
                    const bIsJust = emailB === justRegisteredEmail;
                    if (aIsJust !== bIsJust) return aIsJust ? -1 : 1;
                }

                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
            });

            this.totalRecords = this.users.length;
            this.applyAlphabetFilter();
            this.isLoading = false;
        });
    }

    onPage(event: any): void {
        this.loadUsers(event.first / event.rows);
    }

    viewDetails(user: UserResponse): void {
        // Correction front : on doit utiliser l'id qui correspond au backend.
        // Dans votre fusion Admin+Auth, l'id admin-service peut différer.
        // Sans toucher à la logique métier, on tente d'abord authId (si présent), sinon id.
        // La page Annuaire fusionne Admin + Auth. L’endpoint Admin-service attend l’id Admin-service.
        // Quand user.isAuthOnly === true, l’id présent correspond à Auth-service -> GET admin/users/{id} renvoie 400.
        // On évite l’appel backend et on affiche les détails déjà présents côté front.

        if ((user as any).isAuthOnly === true) {
            this.selectedUserDetails = user;
            this.displayDetail = true;
            return;
        }

        const adminId = (user as any).id ? (user as any).id.toString() : '';
        if (!adminId || adminId === 'undefined') {
            this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'ID utilisateur invalide' });
            return;
        }

        this.adminService.getUserById(adminId).subscribe({
            next: (data) => {
                this.selectedUserDetails = data;
                this.displayDetail = true;
            },
            error: () => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur',
                    detail: 'Impossible de récupérer les détails'
                });
            }
        });
    }

    openFeatures(user: UserResponse): void {
        this.selectedUserForFeatures = user;
        
        // Reset to default depending on the role
        if (user.role === 'MANAGER') {
            this.userFeatures = {
                'ESPACE_DECISION': false, // by default not a VIP
                'ESPACE_SUPERVISION': true
            };
        } else {
            this.userFeatures = {
                'ESPACE_ANALYSTE': true,
                'LIVRABLES': true,
                'LOGS_IA': true
            };
        }

        this.adminService.getUserFeatures(user.email).subscribe({
            next: (features) => {
                // Merge fetched features into defaults so we don't lose the role context
                this.userFeatures = { ...this.userFeatures, ...features };
                this.displayFeatures = true;
            },
            error: () => {
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de récupérer les droits spécifiques.' });
                // Afficher quand même avec les valeurs par défaut
                this.displayFeatures = true; 
            }
        });
    }

    saveUserFeatures(): void {
        if (!this.selectedUserForFeatures) return;

        const payload = Object.keys(this.userFeatures).map(key => ({
            moduleCode: key,
            isEnabled: this.userFeatures[key]
        }));

        this.adminService.updateUserFeatures(this.selectedUserForFeatures.email, payload).subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Droits spécifiques mis à jour.' });
                this.displayFeatures = false;
            },
            error: () => {
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Échec de la sauvegarde des droits.' });
            }
        });
    }

    toggleStatus(user: UserResponse): void {
        if (!user.id || user.id === 'undefined') {
            this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'ID utilisateur invalide' });
            return;
        }

        const isAdminSynced = !(user as any).isAuthOnly;
        const authId = (user as any).authId || user.id;

        this.isLoading = true;

        // On tente d'abord l'action Admin si synchronisé
        if (isAdminSynced) {
            this.adminService.toggleStatus(user.id).subscribe({
                next: (updated) => {
                    const oldStatus = user.status;
                    user.status = updated.status;
                    
                    if (user.status === 'ACTIVE' && oldStatus !== 'ACTIVE') {
                        this.authService.validateUser(authId, user.role).subscribe({
                            next: () => console.log('✅ Auth-Service : Activation et Email déclenchés'),
                            error: (err) => console.warn('❌ Auth-Service error:', err)
                        });
                        this.messageService.add({ severity: 'success', summary: 'Compte Activé', detail: 'Le compte est actif et l\'email a été envoyé.' });
                    } else {
                        this.messageService.add({ severity: 'success', summary: 'Statut mis à jour', detail: `Statut : ${this.getStatusLabel(user.status)}` });
                    }
                    this.isLoading = false;
                },
                error: (err) => {
                    console.warn('[ANNUAIRE] Échec Admin-Service (sync gap possible), tentative via Auth-Service...');
                    this.performAuthOnlyActivation(user, authId);
                }
            });
        } else {
            // Pas encore dans Admin-Service : on agit directement sur Auth-Service pour ne pas bloquer l'admin
            this.performAuthOnlyActivation(user, authId);
        }
    }

    private performAuthOnlyActivation(user: UserResponse, authId: string): void {
        // Pour un utilisateur non-synchro, on ne peut que tenter l'activation (car Auth-Service n'a pas de toggle Inactif)
        this.authService.validateUser(authId, user.role).subscribe({
            next: () => {
                this.messageService.add({ 
                    severity: 'success', 
                    summary: 'Action Réussie', 
                    detail: 'L\'activation a été effectuée. La synchronisation complète sera visible dans quelques instants.' 
                });
                this.isLoading = false;
                setTimeout(() => this.loadUsers(0), 2000);
            },
            error: (err) => {
                this.isLoading = false;
                console.error('[ANNUAIRE] Échec critique activation:', err);
                this.messageService.add({ severity: 'error', summary: 'Échec', detail: 'Impossible de joindre les services de synchronisation.' });
            }
        });
    }

    confirmDelete(user: UserResponse): void {
        this.confirmationService.confirm({
            message: `Supprimer définitivement <strong>${user.email}</strong> ?`,
            header: 'Confirmer la suppression',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Supprimer',
            rejectLabel: 'Annuler',
            acceptButtonStyleClass: 'p-button-danger',
            accept: () => this.deleteUser(user)
        });
    }

    deleteUser(user: UserResponse): void {
        this.adminService.deleteUser(user.id).subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Supprimé', detail: `${user.email} a été marqué comme supprimé` });
                // Au lieu de recharger (ce qui ferait disparaître le compte si le backend fait un hard-delete),
                // on le marque en local pour que l'admin voie l'effet "grisé et verrouillé"
                user.status = 'DELETED';
                this.applyAlphabetFilter();
            },
            error: () => this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de supprimer' })
        });
    }

    roleSeverity(role: string): any {
        const map: any = { ADMIN: 'danger', MANAGER: 'warning', ANALYST: 'info', GUEST: 'secondary' };
        return map[role] || 'secondary';
    }

    getRoleClass(role: string): string {
        const roleLower = (role || 'GUEST').toLowerCase();
        return `role-tag-${roleLower}`;
    }

    getUserStatus(user: UserResponse): string {
        // Priorité au status technique s'il est explicite (REJECTED, ACTIVE, DELETED)
        const s = (user.status || '').toUpperCase();
        if (s === 'REJECTED' || s === 'REFUSED' || s === 'ACTIVE' || s === 'DELETED') return s === 'REFUSED' ? 'REJECTED' : s;

        const accStatus = (user.accountStatus || user.status || 'PENDING').toUpperCase();
        return accStatus === 'REFUSED' ? 'REJECTED' : accStatus;
    }

    getStatusLabel(status: string): string {
        const s = (status || '').toUpperCase();
        if (s === 'ACTIVE') return 'Activé';
        // Un compte validé mais pas encore activé reste "En attente" pour l'utilisateur
        if (s === 'PENDING' || s === 'VALIDATED') return 'En attente';
        return 'Désactivé';
    }

    getStatusSeverity(status: string): string {
        const s = (status || '').toUpperCase();
        if (s === 'ACTIVE') return 'success';
        if (s === 'PENDING' || s === 'VALIDATED') return 'warning';
        return 'danger';
    }

    getStatusIcon(status: string): string {
        const map: Record<string, string> = {
            ACTIVE: 'pi pi-check-circle',
            PENDING: 'pi pi-clock',
            REJECTED: 'pi pi-times-circle',
            DISABLED: 'pi pi-ban',
            DELETED: 'pi pi-trash'
        };
        return map[status] || 'pi pi-info-circle';
    }

}
