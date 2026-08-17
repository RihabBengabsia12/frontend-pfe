import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { AuthService, AccessEvent } from '../../../../demo/service/auth.service';

interface PendingAccount {
    id: string;
    email: string;
    fullName: string;
    role?: string;
    status: string;
    createdAt?: string;
}

@Component({
    templateUrl: './analyst-config.component.html',
    providers: []
})
export class AnalystConfigComponent implements OnInit {

    activeTab = 0;

    // Dossiers en attente
    pendingAccounts: PendingAccount[] = [];
    accountsLoading = false;
    selectedRole: { [id: string]: string } = {};
    roleOptions = [
        { label: 'Utilisateur', value: 'USER' },
        { label: 'Analyste', value: 'ANALYST' },
        { label: 'Manager', value: 'MANAGER' }
    ];

    displayRejectDialog = false;
    rejectionReason = '';
    selectedForReject: PendingAccount | null = null;
    validatingId: string | null = null;

    // Événements
    events: AccessEvent[] = [];
    eventsLoading = false;
    totalEvents = 0;
    eventPage = 0;
    eventSize = 15;
    filterEmail = '';
    filterType = '';

    constructor(
        private authService: AuthService,
        private messageService: MessageService
    ) {}

    ngOnInit(): void {
        this.loadPendingAccounts();
    }

    onTabChange(index: number): void {
        if (index === 1 && this.events.length === 0 && !this.eventsLoading) {
            this.loadEvents();
        }
    }

    loadPendingAccounts(): void {
        this.accountsLoading = true;
        this.authService.getAccounts(0, 500).subscribe({
            next: (res) => {
                const list = res?.content || (Array.isArray(res) ? res : []);
                const myEmail = (sessionStorage.getItem('userEmail') || '').toLowerCase();

                this.pendingAccounts = list
                    .map((u: any) => ({
                        id: u.id || u.userId,
                        email: u.email,
                        fullName: u.fullName || u.username || u.email,
                        role: u.role,
                        status: (u.accountStatus || u.status || 'PENDING').toUpperCase(),
                        createdAt: u.createdAt
                    }))
                    .filter((u: PendingAccount) => {
                        const email = (u.email || '').toLowerCase();
                        return email !== myEmail && u.status === 'PENDING';
                    });

                this.accountsLoading = false;
            },
            error: () => {
                this.accountsLoading = false;
                this.pendingAccounts = [];
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur',
                    detail: 'Impossible de charger GET /api/auth/accounts.'
                });
            }
        });
    }

    validateDossier(account: PendingAccount): void {
        const role = this.selectedRole[account.id] || 'USER';
        this.validatingId = account.id;

        this.authService.validateDossier(account.id, role).subscribe({
            next: () => {
                this.validatingId = null;
                this.messageService.add({
                    severity: 'success',
                    summary: 'Dossier validé',
                    detail: `${account.email} — rôle ${role}.`
                });
                this.loadPendingAccounts();
            },
            error: (err) => {
                this.validatingId = null;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Validation échouée',
                    detail: err.error?.message || 'POST /validate-dossier/{id}.'
                });
            }
        });
    }

    openReject(account: PendingAccount): void {
        this.selectedForReject = account;
        this.rejectionReason = '';
        this.displayRejectDialog = true;
    }

    confirmReject(): void {
        if (!this.selectedForReject) return;

        this.authService.rejectAccount(this.selectedForReject.id, this.rejectionReason || 'Dossier refusé par l\'analyste.').subscribe({
            next: () => {
                this.displayRejectDialog = false;
                this.messageService.add({
                    severity: 'info',
                    summary: 'Dossier refusé',
                    detail: this.selectedForReject!.email
                });
                this.loadPendingAccounts();
            },
            error: (err) => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Refus échoué',
                    detail: err.error?.message || 'PUT /reject/{userId}.'
                });
            }
        });
    }

    loadEvents(): void {
        this.eventsLoading = true;
        this.authService.getEvents({
            page: this.eventPage,
            size: this.eventSize,
            email: this.filterEmail || undefined,
            type: this.filterType || undefined
        }).subscribe({
            next: (page) => {
                this.events = page.content || [];
                this.totalEvents = page.totalElements ?? this.events.length;
                this.eventsLoading = false;
            },
            error: () => {
                this.eventsLoading = false;
                this.events = [];
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur',
                    detail: 'Impossible de charger GET /api/auth/events.'
                });
            }
        });
    }

    applyEventFilters(): void {
        this.eventPage = 0;
        this.loadEvents();
    }

    getEventSeverity(result: string): string {
        const r = (result || '').toUpperCase();
        if (r.includes('SUCCESS') || r === 'OK') return 'success';
        if (r.includes('FAIL')) return 'danger';
        return 'info';
    }
}
