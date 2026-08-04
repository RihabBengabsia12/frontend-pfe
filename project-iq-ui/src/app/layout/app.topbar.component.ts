import { Component, ElementRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { LayoutService } from "./service/app.layout.service";
import { AuthService } from '../demo/service/auth.service';
import { AnalystProjectsService } from '../demo/service/analyst-projects.service';
import { NotificationStateService, AppNotification } from '../demo/service/notification-state.service';
import { PipelineTrackingService } from '../demo/service/pipeline-tracking.service';
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

    @ViewChild('menubutton') menuButton!: ElementRef;
    @ViewChild('topbarmenubutton') topbarMenuButton!: ElementRef;
    @ViewChild('topbarmenu') menu!: ElementRef;

    constructor(
        public layoutService: LayoutService,
        private authService: AuthService,
        private projectsService: AnalystProjectsService,
        public notificationState: NotificationStateService,
        public pipelineTrackingService: PipelineTrackingService,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.notifSub = this.notificationState.notifications$.subscribe(notifs => {
            this.notifications = notifs;
            this.notificationCount = notifs.filter(n => !n.read).length;
        });
    }

    ngOnDestroy(): void {
        if (this.notifSub) {
            this.notifSub.unsubscribe();
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
        const role = localStorage.getItem('userRole') || 'GUEST';
        if (role.toUpperCase() === 'ANALYST') return '/analyst/dashboard';
        if (role.toUpperCase() === 'ADMIN') return '/admin/users';
        if (role.toUpperCase() === 'MANAGER') return '/manager/dashboard';
        return '/landing';
    }

    get userDisplayName(): string {
        const storedName = localStorage.getItem('userName') || localStorage.getItem('userFullName');
        if (storedName && storedName.trim()) return storedName;

        const email = localStorage.getItem('userEmail') || '';
        if (email) {
            const prefix = email.split('@')[0];
            return prefix.charAt(0).toUpperCase() + prefix.slice(1);
        }

        const role = localStorage.getItem('userRole') || 'GUEST';
        if (role.toUpperCase() === 'ANALYST') return 'Analyste';
        if (role.toUpperCase() === 'ADMIN') return 'Administrateur';
        if (role.toUpperCase() === 'MANAGER') return 'Manager';
        return 'Utilisateur';
    }

    get isAnalyst(): boolean {
        return (localStorage.getItem('userRole') || '').toUpperCase() === 'ANALYST';
    }

    get isManager(): boolean {
        return (localStorage.getItem('userRole') || '').toUpperCase() === 'MANAGER';
    }

    get displayRole(): string {
        const role = (localStorage.getItem('userRole') || '').toUpperCase();
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
