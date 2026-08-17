import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { catchError, of, interval, Subscription, forkJoin } from 'rxjs';
import { catchError as catchErrorOp } from 'rxjs/operators';
import { MessageService, ConfirmationService } from 'primeng/api';
import { AdminService, UserResponse, SpringPage } from 'src/app/demo/service/admin.service';
import { AuthService } from 'src/app/demo/service/auth.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
    selector: 'app-validations',
    templateUrl: './validations.component.html'
})
export class ValidationsComponent implements OnInit, OnDestroy {
    trackById(index: number, user: UserResponse): string {
        return user.id;
    }


    guests: UserResponse[] = [];
    allUsers: UserResponse[] = [];
    isLoading = false;
    selectedRoles: { [id: string]: string } = {};
    debugInfo: string = '';
    pendingCount: number = 0;
    exportMenuItems: any[] = [];
    private refreshSub?: Subscription;

    // Filtres
    selectedLetter: string = '';
    alphabet: string[] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    displayedGuests: UserResponse[] = [];

    setFilterLetter(letter: string): void {
        this.selectedLetter = this.selectedLetter === letter ? '' : letter;
        this.applyAlphabetFilter();
    }

    applyAlphabetFilter(): void {
        if (!this.selectedLetter) {
            this.displayedGuests = [...this.guests];
        } else {
            this.displayedGuests = this.guests.filter(u => u.fullName && u.fullName.toUpperCase().startsWith(this.selectedLetter));
        }
    }

    exportPendingPdf(): void {
        const adminEmail = (sessionStorage.getItem('userEmail') || '').toLowerCase();
        const pendingUsers = this.allUsers.filter(u => {
            const status = this.getUserStatus(u);
            const email = u.email ? u.email.toLowerCase() : '';
            const isSelf = email === adminEmail;
            return !isSelf && status === 'PENDING';
        });

        this.generateProfessionalPdf(
            'Rapport des Inscriptions en Attente',
            pendingUsers,
            'comptes_en_attente.pdf'
        );
    }

    exportProcessedPdf(): void {
        const adminEmail = (sessionStorage.getItem('userEmail') || '').toLowerCase();
        const processedUsers = this.allUsers.filter(u => {
            const status = this.getUserStatus(u);
            const email = u.email ? u.email.toLowerCase() : '';
            const isSelf = email === adminEmail;
            return !isSelf && status !== 'PENDING';
        });

        this.generateProfessionalPdf(
            'Rapport des Comptes Validés et Refusés',
            processedUsers,
            'comptes_traites.pdf'
        );
    }

    private generateProfessionalPdf(title: string, users: UserResponse[], filename: string): void {
        const doc = new jsPDF();
        const primaryColor: [number, number, number] = [167, 199, 231]; // Pastel Blue
        const textColor: [number, number, number] = [30, 41, 59]; // Midnight blue

        // Header "Bar"
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 0, 210, 15, 'F');

        // Company Name / Project Name
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text('PROJECT IQ', 14, 10);

        // Title
        doc.setFontSize(22);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(title, 14, 35);

        // Date & Meta
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Document généré le : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 14, 43);
        doc.text(`Total : ${users.length} enregistrements`, 14, 48);

        // Table
        const head = [['Nom complet', 'Email', 'Rôle', 'État Actuel', 'Inscription']];
        const data = users.map(u => [
            u.fullName || '—',
            u.email || '—',
            this.getRoleLabel(u.role),
            this.getStatusLabel(this.getUserStatus(u)),
            u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '—'
        ]);

        autoTable(doc, {
            head: head,
            body: data,
            startY: 55,
            theme: 'striped',
            styles: { fontSize: 9, cellPadding: 3, font: 'helvetica' },
            headStyles: { fillColor: primaryColor, textColor: textColor, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [245, 247, 250] },
            margin: { top: 55 },
            didDrawPage: (dataArg) => {
                // Footer
                doc.setFontSize(8);
                doc.setTextColor(150);
                const pageCount = (doc as any).internal.getNumberOfPages();
                doc.text(`Page ${dataArg.pageNumber} sur ${pageCount}`, 14, doc.internal.pageSize.height - 10);
                doc.text('Confidentiel - Project IQ Administration', doc.internal.pageSize.width - 60, doc.internal.pageSize.height - 10);
            }
        });

        doc.save(filename);
    }

    roleOptions: { label: string, value: string }[] = [
        { label: 'Analyste', value: 'ANALYST' },
        { label: 'Manager', value: 'MANAGER' },
        { label: 'Administrateur', value: 'ADMIN' }
    ];

    displayRejectDialog = false;
    rejectionReason = '';
    selectedUserForRejection: UserResponse | null = null;

    constructor(
        private adminService: AdminService,
        private authService: AuthService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        this.exportMenuItems = [
            { label: 'Exporter les inscriptions en attente', icon: 'pi pi-file-pdf', command: () => this.exportPendingPdf() },
            { label: 'Exporter les comptes traités', icon: 'pi pi-file-pdf', command: () => this.exportProcessedPdf() }
        ];
        this.loadRoles();
        this.loadAllUsers();
        this.refreshSub = interval(10000).subscribe(() => this.loadAllUsers());
    }

    ngOnDestroy(): void {
        this.refreshSub?.unsubscribe();
    }

    loadRoles(): void {
        this.adminService.getRoles().subscribe({
            next: (roles) => {
                console.log('Raw roles:', roles);
                this.roleOptions = roles.map(r => {
                    const label = r.label || r.code || `Rôle ${r.id}`;
                    const value = r.code || r.id.toString();
                    return { label, value };
                });
                console.log('DROPDOWN roleOptions.length:', this.roleOptions.length, this.roleOptions);
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.warn('Roles error:', err);
                this.roleOptions = [
                    { label: 'Analyste', value: 'ANALYST' },
                    { label: 'Manager', value: 'MANAGER' },
                    { label: 'Administrateur', value: 'ADMIN' }
                ];
            }
        });
    }

    loadAllUsers(): void {
        this.isLoading = true;

        // Récupérer les comptes depuis les DEUX microservices et fusionner
        forkJoin({
            adminRes: this.adminService.getUsers(0, 1000).pipe(
                catchError(err => {
                    console.error('[VALIDATIONS] Admin-service indisponible:', err.status);
                    return of({ content: [], totalElements: 0 } as any);
                })
            ),
            authRes: this.authService.getAccounts(0, 1000).pipe(
                catchError(err => {
                    console.error('[VALIDATIONS] Auth-service (accounts) error:', err);
                    if (err.error) console.error('[VALIDATIONS] Auth-service error body:', err.error);
                    return of({ content: [] } as any);
                })
            )
        }).subscribe(({ adminRes, authRes }) => {
            const adminList: UserResponse[] = adminRes?.content || [];
            const authList: any[] = authRes?.content || (Array.isArray(authRes) ? authRes : []);

            // Fusionner par EMAIL
            const userMap = new Map<string, UserResponse>();

            // 1. Priorité aux données de Admin-Service
            for (const u of adminList) {
                const email = (u.email || '').toLowerCase().trim();
                if (!email) continue;
                userMap.set(email, u);
            }

            // 2. Ajouter/Mettre à jour depuis Auth-Service (Priorité au statut REJECTED)
            for (const au of authList) {
                const email = (au.email || '').toLowerCase().trim();
                const authId = au.id || au.userId || au.uuid || au.authId;
                const authStatus = (au.accountStatus || au.status || 'PENDING').toUpperCase();
                const rejectedEmails = JSON.parse(sessionStorage.getItem('rejectedEmails') || '[]');
                
                if (userMap.has(email)) {
                    const existing = userMap.get(email)!;
                    (existing as any).authId = authId;
                    (existing as any).isAuthOnly = false;

                    // AUTO-SYNC BLINDÉ : Priorité au rôle Admin ou Buffer Local
                    const pendingRoles = JSON.parse(sessionStorage.getItem('pendingRoles') || '{}');
                    const bufferedRole = pendingRoles[email];

                    if (bufferedRole) {
                        existing.role = bufferedRole;
                    } else if (existing.role === 'GUEST' && au.role && au.role !== 'GUEST') {
                        existing.role = au.role;
                    }

                    if (authStatus === 'REJECTED' || authStatus === 'REFUSED' || rejectedEmails.includes(email)) {
                        console.log(`[DEBUG] Forçage du statut REJECTED pour ${email}`);
                        existing.status = 'REJECTED';
                        existing.accountStatus = 'REJECTED';
                    }
                    console.log(`[DEBUG-MERGE] Email: ${email} | AdminId: ${existing.id} | AuthId: ${authId}`);
                } else {
                    const pendingRoles = JSON.parse(sessionStorage.getItem('pendingRoles') || '{}');
                    const bufferedRole = pendingRoles[email];

                    userMap.set(email, {
                        id: authId,
                        email: au.email,
                        fullName: au.fullName || au.username || email.split('@')[0],
                        role: bufferedRole || au.role || 'GUEST',
                        status: authStatus === 'REFUSED' ? 'REJECTED' : authStatus,
                        accountStatus: authStatus === 'REFUSED' ? 'REJECTED' : authStatus,
                        createdAt: au.createdAt,
                        authId: authId,
                        isAuthOnly: true
                    } as any);
                }
            }

            const allMerged = Array.from(userMap.values());
            
            // Dernière passe de sécurité avec sessionStorage pour les comptes fraîchement refusés
            const rejectedEmails = JSON.parse(sessionStorage.getItem('rejectedEmails') || '[]');
            for (const user of allMerged) {
                if (user.email && rejectedEmails.includes(user.email.toLowerCase().trim())) {
                    user.status = 'REJECTED';
                    user.accountStatus = 'REJECTED';
                }
            }

            this.allUsers = allMerged;

            const adminEmail = (sessionStorage.getItem('userEmail') || '').toLowerCase();
            this.guests = allMerged.filter(u => {
                const email = (u.email || '').toLowerCase();
                const isSelf = email && email === adminEmail;
                const isSystemAdmin = email === 'admin@st2i.tn' || email === 'admin@projectiq.com';
                
                return !isSelf && !isSystemAdmin;
            });

            this.pendingCount = this.guests.filter(u => this.getUserStatus(u) === 'PENDING').length;

            // Priorité : les nouveaux comptes en PENDING (fraîchement créés) doivent remonter en haut.
            // Sans toucher à la logique fonctionnelle : on ne change que le tri d'affichage.
            const justRegisteredEmail = (sessionStorage.getItem('pendingEmail') || '').toLowerCase().trim();

            this.guests.sort((a, b) => {
                const statusA = this.getUserStatus(a);
                const statusB = this.getUserStatus(b);

                // 1) Toujours remonter PENDING avant les autres statuts
                if (statusA !== statusB) {
                    return statusA === 'PENDING' ? -1 : 1;
                }

                // 2) Si c'est l'utilisateur tout juste inscrit, le placer tout en haut
                const emailA = (a.email || '').toLowerCase().trim();
                const emailB = (b.email || '').toLowerCase().trim();

                if (justRegisteredEmail) {
                    const aIsJust = emailA === justRegisteredEmail;
                    const bIsJust = emailB === justRegisteredEmail;
                    if (aIsJust !== bIsJust) {
                        return aIsJust ? -1 : 1;
                    }
                }

                // 3) Sinon tri par createdAt desc
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
            });


            this.applyAlphabetFilter();
            this.debugInfo = `✅ ${this.guests.length} comptes trouvés (Aggregat Auth+Admin)`;
            this.isLoading = false;
        });
    }

    onValidateUser(user: UserResponse): void {
        const roleCode = this.selectedRoles[user.id];
        const authId = (user as any).authId || user.id;
        const isAdminSynced = !(user as any).isAuthOnly;

        console.log(`[VALIDATE] Tentative pour ${user.email} | adminId: ${user.id} | authId: ${authId} | synced: ${isAdminSynced}`);

        if (!roleCode) {
            this.messageService.add({ severity: 'warn', summary: 'Attention', detail: 'Veuillez sélectionner un rôle' });
            return;
        }

        if (!authId || authId === 'undefined') {
            console.error('[VALIDATE] Impossible de valider : ID manquant');
            this.messageService.add({ severity: 'error', summary: 'Erreur critique', detail: 'ID de l\'utilisateur introuvable. Veuillez rafraîchir la page.' });
            return;
        }

        this.isLoading = true;

        // Étape 1 : Valider le dossier dans le Auth-Service (Source de vérité)
        // Cela met le statut à 'VALIDATED' dans Auth-Service
        this.authService.validateDossier(authId, roleCode).subscribe({
            next: () => {
                console.log('[VALIDATE] authService.validateDossier OK');

                // Étape 2 : Assigner le rôle dans le Admin-Service (Source de persistance pour le rôle)
                if (user.id && user.id !== 'undefined') {
                    this.adminService.assignRole(user.id, roleCode).subscribe({
                        next: () => {
                            console.log('[VALIDATE] Rôle enregistré dans Admin-Service');
                            // On nettoie le buffer local si l'admin a réussi
                            const pendingRoles = JSON.parse(sessionStorage.getItem('pendingRoles') || '{}');
                            delete pendingRoles[user.email];
                            sessionStorage.setItem('pendingRoles', JSON.stringify(pendingRoles));
                        },
                        error: (err) => {
                            console.warn('[VALIDATE] Sync Gap détecté. Mémorisation du rôle dans le buffer local.');
                            const emailKey = (user.email || '').toLowerCase().trim();
                            const pendingRoles = JSON.parse(sessionStorage.getItem('pendingRoles') || '{}');
                            pendingRoles[emailKey] = roleCode;
                            sessionStorage.setItem('pendingRoles', JSON.stringify(pendingRoles));
                        }
                    });
                }

                this.messageService.add({
                    severity: 'success', summary: 'Dossier Validé !',
                    detail: `${user.email} a été validé. Le compte reste désactivé jusqu'à l'activation finale.`
                });
                
                this.isLoading = false;
                setTimeout(() => this.loadAllUsers(), 1500);
            },
            error: (err) => {
                this.isLoading = false;
                this.messageService.add({
                    severity: 'error', summary: 'Échec',
                    detail: err.error?.message || 'Erreur de communication avec le service d\'authentification.'
                });
            }
        });
    }

    rejectAccount(user: UserResponse): void {
        this.selectedUserForRejection = user;
        this.rejectionReason = '';
        this.displayRejectDialog = true;
    }

    confirmReject(): void {
        if (!this.selectedUserForRejection) return;

        this.isLoading = true;
        
        // FORCAGE LOCAL IMMEDIAT (Même si le backend échoue, l'interface obéira à l'utilisateur)
        const emailToReject = (this.selectedUserForRejection.email || '').toLowerCase().trim();
        if (emailToReject) {
            const rejectedEmails = JSON.parse(sessionStorage.getItem('rejectedEmails') || '[]');
            if (!rejectedEmails.includes(emailToReject)) {
                rejectedEmails.push(emailToReject);
                sessionStorage.setItem('rejectedEmails', JSON.stringify(rejectedEmails));
            }
        }
        this.selectedUserForRejection.status = 'REJECTED';
        this.selectedUserForRejection.accountStatus = 'REJECTED';
        this.displayRejectDialog = false;

        const authId = (this.selectedUserForRejection as any).authId || this.selectedUserForRejection.id;
        console.log(`[DEBUG-REJECT] Calling rejectAccount for email: ${this.selectedUserForRejection.email}, authId: ${authId}, adminId: ${this.selectedUserForRejection.id}`);
        
        this.authService.rejectAccount(authId, this.rejectionReason).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'info',
                    summary: 'Compte refusé',
                    detail: `Le compte de ${this.selectedUserForRejection!.email} a été marqué comme refusé.`
                });
                this.isLoading = false;
                setTimeout(() => this.loadAllUsers(), 1500);
            },
            error: (err) => {
                this.isLoading = false;
                console.error(`[DEBUG-REJECT] rejectAccount failed:`, err);
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Refus Forcé Localement',
                    detail: 'Le serveur a rencontré une erreur, mais le compte a été bloqué sur votre interface.'
                });
                setTimeout(() => this.loadAllUsers(), 500);
            }
        });
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
        const labels: Record<string, string> = {
            PENDING: 'En attente',
            VALIDATED: 'Validé',
            ACTIVE: 'Validé',
            REJECTED: 'Refusé'
        };
        return labels[s] || s;
    }

    getStatusSeverity(status: string): string {
        const s = (status || '').toUpperCase();
        const map: Record<string, string> = {
            ACTIVE: 'success',
            VALIDATED: 'info',
            PENDING: 'warning',
            REJECTED: 'danger'
        };
        return map[s] || 'info';
    }

    getStatusIcon(status: string): string {
        const map: Record<string, string> = {
            ACTIVE: 'pi pi-check-circle',
            VALIDATED: 'pi pi-check-circle',
            DISABLED: 'pi pi-check-circle',
            PENDING: 'pi pi-clock',
            REJECTED: 'pi pi-times-circle'
        };
        return map[status] || 'pi pi-info-circle';
    }

    getRoleLabel(roleCode: string): string {
        if (!roleCode) return 'Aucun';
        const option = this.roleOptions.find(o => o.value === roleCode);
        return option ? option.label : roleCode;
    }

    getRoleClass(role: string): string {
        const roleLower = (role || 'GUEST').toLowerCase();
        return `role-tag-${roleLower}`;
    }
}

