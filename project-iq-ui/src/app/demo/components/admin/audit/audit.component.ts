import { Component, OnInit } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AdminService, DataEvent, UserResponse } from 'src/app/demo/service/admin.service';
import { AuthService, AccessEvent } from 'src/app/demo/service/auth.service';

export interface AuditRow {
    id: string;
    occurredAt: string;
    service: 'Auth' | 'Admin';
    actorId: string;
    actorEmail: string;
    actorFullName?: string;
    action: string;
    target: string;
    targetId?: string; // ID de l'entité cible si c'est un utilisateur
    status: 'SUCCESS' | 'FAILURE' | 'WARNING';
    ipAddress?: string;
    count: number;
    details?: string;
    subEvents?: AuditRow[];
}

export interface UserAuditGroup {
    actorId: string;
    actorEmail: string;
    actorFullName?: string;
    lastActivity: string;
    totalEvents: number;
    events: AuditRow[];
}

@Component({ selector: 'app-audit', templateUrl: './audit.component.html' })
export class AuditComponent implements OnInit {
    allRows: AuditRow[] = [];
    filteredGroups: UserAuditGroup[] = [];
    isLoading = false;
    filterAction = '';
    filterService = '';
    dateRange: Date[] = [];
    tabService = 'all'; // 'all' | 'auth' | 'admin'
    
    // User details modal
    displayDetail = false;
    selectedUserDetails: UserResponse | null = null;
    isResolvingUser = false;

    private userMap: { [id: string]: { email: string, fullName: string } } = {};

    actionOptions = [
        { label: 'Toutes', value: '' },
        { label: 'Connexion', value: 'LOGIN_SUCCESS' },
        { label: 'Suppression', value: 'DELETE' },
        { label: 'Rôle', value: 'ASSIGN_ROLE' }
    ];

    constructor(
        private adminService: AdminService,
        private authService: AuthService
    ) {}

    ngOnInit(): void { this.loadAll(); }

    loadAll(): void {
        this.isLoading = true;
        this.seedCurrentUserFromJwt();
        this.adminService.getUsers(0, 1000).pipe( // Fetch more users to populate the map
            catchError(() => of({ content: [], totalElements: 0 } as any))
        ).subscribe(users => {
            users.content.forEach((u: UserResponse) => {
                this.userMap[u.id] = { email: u.email, fullName: u.fullName || u.email };
            });
            this.loadEvents();
        });
    }

    private seedCurrentUserFromJwt(): void {
        const token = localStorage.getItem('accessToken');
        const email = localStorage.getItem('userEmail');
        let fullName = localStorage.getItem('userFullName');
        if (!fullName) fullName = email;
        
        if (!token || !email) return;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const id = payload.sub || payload.userId || payload.id || payload.iss;
            this.userMap[id] = { email, fullName: fullName! };
        } catch (e) {}
    }

    loadEvents(): void {
        forkJoin({
            admin: this.adminService.getAuditEvents({ page: 0, size: 100 }).pipe(
                catchError((err) => {
                    console.error('Erreur API Admin (getAuditEvents):', err);
                    return of({ content: [] } as any);
                })
            ),
            auth: this.authService.getEvents({ page: 0, size: 100 }).pipe(
                catchError((err) => {
                    console.error('Erreur API Auth (getEvents):', err);
                    return of({ content: [] } as any);
                })
            )
        }).subscribe(({ admin, auth }) => {
            const adminEvents = admin?.content || [];
            const authEvents = auth?.content || [];
            
            // 🔍 Collecter tous les IDs d'utilisateurs présents dans les logs mais absents de la map
            const missingIds = new Set<string>();
            adminEvents.forEach((e: any) => {
                if (e.actorUserId && !this.userMap[e.actorUserId] && e.actorUserId.length > 20) missingIds.add(e.actorUserId);
                // Broaden the check for user-related entities
                const isUserRelated = e.entityName === 'AppUser' || e.entityName === 'User' || e.entityName === 'CredentialAccount' || (e.action && e.action.includes('USER'));
                if (e.entityId && !this.userMap[e.entityId] && e.entityId.length > 20 && isUserRelated) missingIds.add(e.entityId);
            });
            authEvents.forEach((e: any) => {
                if (e.userId && !this.userMap[e.userId] && e.userId.length > 20) missingIds.add(e.userId);
            });

            if (missingIds.size > 0) {
                // 📡 Récupérer les détails des utilisateurs manquants en parallèle
                const fetchObs = Array.from(missingIds).map(id => 
                    this.adminService.getUserById(id).pipe(catchError(() => of(null)))
                );
                
                forkJoin(fetchObs).subscribe(results => {
                    results.forEach(u => {
                        if (u) this.userMap[u.id] = { email: u.email, fullName: u.fullName || u.email };
                    });
                    this.finalizeEvents(adminEvents, authEvents);
                });
            } else {
                this.finalizeEvents(adminEvents, authEvents);
            }
        });
    }

    private finalizeEvents(adminEvents: any[], authEvents: any[]): void {
        this.allRows = [...adminEvents.map(e => this.mapAdmin(e)), ...authEvents.map(e => this.mapAuth(e))]
            .sort((a, b) => {
                const tA = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
                const tB = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
                return tB - tA;
            });
        this.applyFilters();
        this.isLoading = false;
    }

    private resolveUser(id: string): { email: string, fullName: string } {
        if (!id || id === 'system' || id === '00000000-0000-0000-0000-000000000000' || id.toLowerCase().includes('admin')) {
            return { email: 'system@project-iq.tn', fullName: 'Service Système' };
        }
        
        // Si l'ID est déjà un email (format courant dans les logs Auth)
        if (id.includes('@')) {
            return { email: id, fullName: id.split('@')[0] };
        }

        if (this.userMap[id]) return this.userMap[id];
        
        // Si c'est un ID long non résolu
        if (id.length > 20) {
            return { email: 'Contact non résolu', fullName: 'Utilisateur Plateforme' };
        }
        
        return { email: id, fullName: 'Utilisateur' };
    }

    private translateTechnicalTerm(term: string): string {
        if (!term) return '';
        const map: Record<string, string> = {
            'ACTIVE': 'Compte Actif',
            'DISABLED': 'En attente d\'activation',
            'PENDING': 'En attente de validation',
            'VALIDATED': 'Dossier Validé',
            'GUEST': 'Visiteur',
            'ADMIN': 'Administrateur',
            'ANALYST': 'Analyste',
            'MANAGER': 'Manager',
            'AppUser': 'Profil Utilisateur',
            'CredentialAccount': 'Compte Sécurisé',
            'REJECTED': 'Dossier Refusé',
            'SYNC_RABBITMQ': 'Synchronisation Inter-Services',
            'SUCCESS': 'Réussite',
            'FAILURE': 'Échec'
        };
        return map[term] || term;
    }

    private mapAdmin(e: DataEvent): AuditRow {
        const actor = this.resolveUser(e.actorUserId);
        const action = e.action || 'UNKNOWN';
        
        // Cible de l'action
        let target = '';
        const entityUser = this.userMap[e.entityId];
        
        if (entityUser) {
            target = entityUser.fullName || entityUser.email;
        } else if (e.entityName === 'AppUser' || e.entityName === 'User' || e.entityName === 'CredentialAccount') {
            target = e.oldData?.includes('@') ? e.oldData : (e.newData?.includes('@') ? e.newData : 'Utilisateur');
        } else {
            target = this.translateTechnicalTerm(e.entityName || e.ressource || 'Système');
        }
        
        let details = 'Opération effectuée avec succès';
        
        // Logique spécifique pour le REFUS (Traduire en texte clair et visible)
        if (action === 'REJECT' || action === 'REJECT_ACCOUNT' || (action === 'TOGGLE_STATUS' && e.newData === 'REJECTED')) {
            details = `Dossier Refusé : L'accès a été définitivement rejeté par l'administration.`;
        } else if (action === 'ASSIGN_ROLE' && e.newData) {
            details = `Modification des privilèges vers : ${this.translateTechnicalTerm(e.newData)}`;
        } else if (action === 'TOGGLE_STATUS' && e.newData) {
            const status = this.translateTechnicalTerm(e.newData);
            details = `Changement d'état du compte vers : ${status}`;
        } else if (action === 'SYNC_RABBITMQ') {
            // Détection si la sync concerne un compte qui vient d'être refusé
            if (entityUser && (entityUser as any).status === 'REJECTED') {
                details = 'Synchronisation système : Confirmation du refus d\'accès pour ce dossier.';
            } else {
                details = 'Mise à jour automatique des bases de données';
            }
        } else if (e.newData && e.oldData) {
            details = `Mise à jour de '${this.translateTechnicalTerm(e.oldData)}' vers '${this.translateTechnicalTerm(e.newData)}'`;
        } else if (e.newData) {
            details = `Définition : ${this.translateTechnicalTerm(e.newData)}`;
        }

        return {
            id: e.id,
            occurredAt: e.occurredAt,
            service: 'Admin' as const,
            actorId: e.actorUserId,
            actorEmail: actor.email,
            actorFullName: actor.fullName,
            action,
            target,
            targetId: (e.entityName === 'AppUser' || e.entityName === 'User' || e.entityName === 'CredentialAccount') ? e.entityId : undefined,
            details,
            status: 'SUCCESS',
            count: 1
        };
    }

    private mapAuth(e: AccessEvent): AuditRow {
        // Fallback pro si l'ID est absent
        const actorId = e.userId || e.emailAttempted || 'system';
        let actor = this.resolveUser(actorId);
        
        if (e.emailAttempted && e.emailAttempted.includes('@')) {
            actor = { email: e.emailAttempted, fullName: e.emailAttempted };
        }
        
        const action = e.eventType || 'UNKNOWN';
        
        let details = 'Événement de sécurité plateforme';
        if (action.includes('FAIL')) {
            details = 'Tentative d\'accès refusée (identifiants incorrects)';
        } else if (action === 'REGISTER' || action === 'CREATE') {
            details = 'Nouvelle demande d\'adhésion enregistrée';
        } else if (action === 'ACTIVATION_FINALE') {
            details = 'Validation définitive de l\'accès par l\'utilisateur';
        } else if (action === 'VALIDATION_DOSSIER') {
            details = 'Dossier approuvé et validé par l\'administrateur';
        } else if (action === 'REJECT' || action === 'REJECT_ACCOUNT') {
            details = 'Dossier rejeté : L\'accès est désormais bloqué pour cet utilisateur';
        } else if (action.includes('BLOCKED') || action.includes('LOCKED')) {
            details = 'Accès restreint pour protéger le compte';
        } else if (action === 'LOGOUT') {
            details = 'Session clôturée avec succès';
        } else if (action === 'LOGIN_SUCCESS') {
            details = 'Authentification réussie et accès au tableau de bord';
        }

        return {
            id: e.id,
            occurredAt: e.occurredAt,
            service: 'Auth' as const,
            actorId: actorId,
            actorEmail: actor.email,
            actorFullName: actor.fullName,
            action,
            target: actor.email,
            targetId: actorId,
            details,
            status: e.result === 'SUCCESS' ? 'SUCCESS' : 'FAILURE',
            ipAddress: e.ipAddress || 'Client identifié',
            count: 1
        };
    }

    applyFilters(): void {
        let rows = this.allRows.filter(r => !this.filterAction || r.action === this.filterAction)
                               .filter(r => !this.filterService || r.service === this.filterService)
                               .filter(r => {
                                   if (!this.dateRange || !this.dateRange[0]) return true;
                                   const eventDate = new Date(r.occurredAt);
                                   const start = this.dateRange[0];
                                   const end = this.dateRange[1];
                                   if (end) {
                                       const endOfDay = new Date(end);
                                       endOfDay.setHours(23, 59, 59, 999);
                                       return eventDate >= start && eventDate <= endOfDay;
                                   }
                                   return eventDate >= start;
                               });

        let consolidatedRows: AuditRow[] = [];
        const seenEvents = new Map<string, AuditRow>();

        rows.forEach(r => {
            const dateStr = r.occurredAt ? r.occurredAt.substring(0, 10) : new Date().toISOString().substring(0, 10);
            const dayKey = `${r.action}-${r.service}-${r.actorId}-${r.target}-${dateStr}`;
            if (!seenEvents.has(dayKey)) {
                r.subEvents = [];
                seenEvents.set(dayKey, r);
                consolidatedRows.push(r);
            } else {
                const parentRow = seenEvents.get(dayKey)!;
                parentRow.count++;
                parentRow.subEvents!.push(r);
            }
        });

        const userGroups = new Map<string, UserAuditGroup>();
        consolidatedRows.forEach(r => {
            if (!userGroups.has(r.actorId)) {
                userGroups.set(r.actorId, {
                    actorId: r.actorId,
                    actorEmail: r.actorEmail,
                    actorFullName: r.actorFullName,
                    lastActivity: r.occurredAt,
                    totalEvents: 0,
                    events: []
                });
            }
            const group = userGroups.get(r.actorId)!;
            group.events.push(r);
            group.totalEvents += r.count;
            
            if (new Date(r.occurredAt) > new Date(group.lastActivity)) {
                group.lastActivity = r.occurredAt;
            }
        });

        this.filteredGroups = Array.from(userGroups.values()).sort((a, b) => 
            new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
        );
    }

    viewUserDetails(userId: string): void {
        if (!userId || userId.length < 20 || userId === 'system' || userId.includes('@')) return;
        
        this.isResolvingUser = true;
        this.adminService.getUserById(userId).subscribe({
            next: (user) => {
                this.selectedUserDetails = user;
                this.displayDetail = true;
                this.isResolvingUser = false;
            },
            error: () => {
                this.isResolvingUser = false;
            }
        });
    }

    onFilter(): void {
        this.applyFilters();
    }

    resetFilters(): void {
        this.filterAction = '';
        this.filterService = '';
        this.dateRange = [];
        this.tabService = 'all';
        this.applyFilters();
    }

    getActionLabel(action: string): string {
        const labels: Record<string, string> = {
            DELETE: 'Suppression définitive',
            ASSIGN_ROLE: 'Gestion des privilèges',
            LOGIN_SUCCESS: 'Accès autorisé',
            LOGIN_FAILURE: 'Accès refusé',
            LOGIN_BLOCKED: 'Sécurité : Blocage',
            ACCOUNT_LOCKED: 'Sécurité : Verrouillage',
            LOGOUT: 'Fermeture de session',
            TOGGLE_STATUS: 'Changement de statut',
            REGISTER: 'Inscription plateforme',
            CREATE: 'Nouvelle demande',
            CRÉATION: 'Nouvelle demande',
            SYNC_RABBITMQ: 'Maintenance système',
            ACTIVATION_FINALE: 'Activation email',
            VALIDATION_DOSSIER: 'Validation dossier',
            REJECT: 'Refus d\'inscription',
            REJECT_ACCOUNT: 'Refus d\'inscription'
        };
        return labels[action] || action;
    }

    getEventIcon(action: string): string {
        const icons: Record<string, string> = {
            DELETE: 'pi pi-trash',
            ASSIGN_ROLE: 'pi pi-key',
            LOGIN_SUCCESS: 'pi pi-sign-in',
            LOGIN_FAILURE: 'pi pi-ban',
            LOGIN_BLOCKED: 'pi pi-lock',
            ACCOUNT_LOCKED: 'pi pi-lock',
            LOGOUT: 'pi pi-sign-out',
            TOGGLE_STATUS: 'pi pi-cog',
            REGISTER: 'pi pi-user-plus',
            CREATE: 'pi pi-user-plus',
            CRÉATION: 'pi pi-user-plus',
            SYNC_RABBITMQ: 'pi pi-sync',
            ACTIVATION_FINALE: 'pi pi-envelope',
            VALIDATION_DOSSIER: 'pi pi-check-square',
            REJECT: 'pi pi-user-minus',
            REJECT_ACCOUNT: 'pi pi-user-minus'
        };
        return icons[action] || 'pi pi-list';
    }

    getEventSeverity(action: string): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
        if (['DELETE', 'LOGIN_FAILURE', 'LOGIN_BLOCKED', 'REJECT', 'REJECT_ACCOUNT'].includes(action)) return 'danger';
        if (action.includes('ROLE') || action === 'SYNC_RABBITMQ') return 'info';
        if (['LOGIN_SUCCESS', 'VALIDATION_DOSSIER', 'ACTIVATION_FINALE'].includes(action)) return 'success';
        if (['TOGGLE_STATUS'].includes(action)) return 'warning';
        return 'secondary';
    }

    getStatusSeverity(status: string): 'success' | 'warning' | 'danger' | 'secondary' {
        return status === 'SUCCESS' ? 'success' : status === 'FAILURE' ? 'danger' : 'warning';
    }

    getStatusLabel(status: string): string {
        return status === 'SUCCESS' ? 'Opération réussie' : status === 'FAILURE' ? 'Échoué' : 'Attention';
    }

    getMomentLabel(dateStr: string): string {
        const date = new Date(dateStr);
        const today = new Date();
        if (date.toDateString() === today.toDateString()) return 'Aujourd\'hui';
        if (date.toDateString() === new Date(today.getTime() - 86400000).toDateString()) return 'Hier';
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }
}
