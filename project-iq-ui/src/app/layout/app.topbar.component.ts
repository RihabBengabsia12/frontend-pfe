import { Component, ElementRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { LayoutService } from "./service/app.layout.service";
import { AuthService } from '../demo/service/auth.service';
import { AnalystProjectsService } from '../demo/service/analyst-projects.service';
import { NotificationStateService, AppNotification } from '../demo/service/notification-state.service';
import { PipelineTrackingService } from '../demo/service/pipeline-tracking.service';
import { ManagerValidationService } from '../demo/service/manager-validation.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-topbar',
    templateUrl: './app.topbar.component.html'
})
export class AppTopBarComponent implements OnInit, OnDestroy {

    items!: MenuItem[];
    notificationCount = 0;
    notifications: AppNotification[] = [];
    private notifSub!: Subscription;
    private managerPollInterval: any;
    private lastNogoCount: number = -1;
    private lastPackCount: number = -1;

    @ViewChild('menubutton') menuButton!: ElementRef;
    @ViewChild('topbarmenubutton') topbarMenuButton!: ElementRef;
    @ViewChild('topbarmenu') menu!: ElementRef;

    constructor(
        public layoutService: LayoutService,
        private authService: AuthService,
        private projectsService: AnalystProjectsService,
        public notificationState: NotificationStateService,
        public pipelineTrackingService: PipelineTrackingService,
        private managerValidationService: ManagerValidationService,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.notifSub = this.notificationState.notifications$.subscribe(notifs => {
            // Afficher dans la cloche UNIQUEMENT les notifs marquées showInBell:true
            this.notifications = notifs.filter(n => n.showInBell === true);
            this.notificationCount = this.notifications.filter(n => !n.read).length;
        });

        // Polling dynamique pour le manager (Toutes les 15 secondes)
        if (this.isManager) {
            this.notificationState.removeByTitles(['Pack en attente', 'Nouveau Pack en attente', 'Tâches en attente', 'Nouvelle tâche en attente']);
            this.checkManagerTasks();
            this.managerPollInterval = setInterval(() => {
                this.checkManagerTasks();
            }, 15000);
        }
    }

    private checkManagerTasks(): void {
        const email = sessionStorage.getItem('userEmail');
        if (email) {
            this.managerValidationService.getPendingValidations(email).subscribe(validations => {
                // Une alerte existe seulement s'il y a un token PENDING attribué à ce manager.
                const currentCount = (validations || []).filter((v: any) => v.decisionStatus === 'PENDING').length;
                if (currentCount === this.lastPackCount) return;

                this.notificationState.removeByAction('MANAGER_PENDING_VALIDATION');
                if (currentCount > 0) {
                    this.notificationState.addNotification({
                        title: 'Pack en attente de votre décision',
                        message: `Vous avez ${currentCount} pack(s) réellement prêt(s) à valider.`,
                        detail: 'Votre validation personnelle est requise.',
                        type: 'info',
                        link: '/manager/decisions-finales',
                        action: 'MANAGER_PENDING_VALIDATION',
                        showInBell: true,
                        silent: this.lastPackCount === -1
                    });
                }
                this.lastPackCount = currentCount;
            });
            return;
        }

        this.managerValidationService.getDossiersWithNoGo().subscribe(nogoList => {
            if (nogoList) {
                const currentCount = nogoList.length;
                if (currentCount > 0 && currentCount > this.lastNogoCount && this.lastNogoCount !== -1) {
                    this.notificationState.addNotification({
                        title: 'Nouvelle tâche en attente',
                        message: `Vous avez un nouveau dossier avec un rapport No-Go en attente de décision. (Total: ${currentCount})`,
                        detail: 'Veuillez valider ou forcer ce dossier.',
                        type: 'warning',
                        link: '/manager/decisions-finales',
                        showInBell: true
                    });
                } else if (currentCount > 0 && this.lastNogoCount === -1) {
                     // Initial load without pushing a new notif that triggers a toast every refresh
                     this.notificationState.addNotification({
                        title: 'Tâches en attente',
                        message: `Vous avez ${currentCount} dossier(s) avec un rapport No-Go en attente.`,
                        detail: 'Veuillez valider ou forcer ces dossiers.',
                        type: 'warning',
                        link: '/manager/decisions-finales',
                        showInBell: true,
                        silent: true // don't show toast on initial load
                    });
                }
                this.lastNogoCount = currentCount;
            }
        });
        
        this.managerValidationService.getDossiersWithPacks().subscribe(packsList => {
            if (packsList) {
                const pendingPacks = packsList.filter((d: any) => d.status === 'SUBMITTED' || d.status === 'PENDING_VALIDATION' || d.status === 'PACK_READY');
                const currentCount = pendingPacks.length;
                if (currentCount > 0 && currentCount > this.lastPackCount && this.lastPackCount !== -1) {
                    this.notificationState.addNotification({
                        title: 'Nouveau Pack en attente',
                        message: `Vous avez un nouveau pack complet en attente de décision. (Total: ${currentCount})`,
                        detail: 'Veuillez valider ou rejeter ce dossier.',
                        type: 'info',
                        link: '/manager/decisions-finales',
                        showInBell: true
                    });
                } else if (currentCount > 0 && this.lastPackCount === -1) {
                    this.notificationState.addNotification({
                        title: 'Pack en attente',
                        message: `Vous avez ${currentCount} pack(s) en attente de décision.`,
                        detail: 'Veuillez valider ou rejeter ces dossiers.',
                        type: 'info',
                        link: '/manager/decisions-finales',
                        showInBell: true,
                        silent: true // don't show toast on initial load
                    });
                }
                this.lastPackCount = currentCount;
            }
        });
    }

    ngOnDestroy(): void {
        if (this.notifSub) {
            this.notifSub.unsubscribe();
        }
        if (this.managerPollInterval) {
            clearInterval(this.managerPollInterval);
        }
    }

    onNotificationClick(event: Event, overlayPanel: any): void {
        this.notificationState.markAllAsRead();
        overlayPanel.toggle(event);
    }

    onNotificationItemClick(notif: AppNotification, overlayPanel: any): void {
        overlayPanel.hide();
        if (notif.action === 'SHOW_PIPELINE_MODAL') {
            this.pipelineTrackingService.showModal();
            if (notif.link) {
                this.router.navigate([notif.link]);
            }
        } else if (notif.link) {
            this.router.navigate([notif.link]);
        }
    }

    onLogout(): void {
        this.authService.logout();
        this.router.navigate(['/auth/login']);
    }

    get logoRoute(): string {
        const role = sessionStorage.getItem('userRole') || 'GUEST';
        if (role.toUpperCase() === 'ANALYST') return '/analyst/dashboard';
        if (role.toUpperCase() === 'ADMIN') return '/admin/users';
        if (role.toUpperCase() === 'MANAGER') return '/manager/dashboard';
        return '/landing';
    }

    get userDisplayName(): string {
        const storedName = sessionStorage.getItem('userName') || sessionStorage.getItem('userFullName');
        if (storedName && storedName.trim()) return storedName;

        const email = sessionStorage.getItem('userEmail') || '';
        if (email) {
            const prefix = email.split('@')[0];
            return prefix.charAt(0).toUpperCase() + prefix.slice(1);
        }

        const role = sessionStorage.getItem('userRole') || 'GUEST';
        if (role.toUpperCase() === 'ANALYST') return 'Analyste';
        if (role.toUpperCase() === 'ADMIN') return 'Administrateur';
        if (role.toUpperCase() === 'MANAGER') return 'Manager';
        return 'Utilisateur';
    }

    get isAnalyst(): boolean {
        return (sessionStorage.getItem('userRole') || '').toUpperCase() === 'ANALYST';
    }

    get isManager(): boolean {
        return (sessionStorage.getItem('userRole') || '').toUpperCase() === 'MANAGER';
    }

    get displayRole(): string {
        const role = (sessionStorage.getItem('userRole') || '').toUpperCase();
        if (role === 'ANALYST') return 'Analyste Connecté';
        if (role === 'MANAGER') return 'Manager Connecté';
        if (role === 'ADMIN') return 'Administrateur Connecté';
        return 'Utilisateur Connecté';
    }

    get userInitials(): string {
        const name = this.userDisplayName;
        if (name.toLowerCase() === 'ryry1') return 'RY';
        return name.substring(0, 2).toUpperCase();
    }
}
