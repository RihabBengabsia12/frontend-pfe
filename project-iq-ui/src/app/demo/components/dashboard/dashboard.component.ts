import { Component, OnInit, OnDestroy } from '@angular/core';
import { AdminService, DataEvent, UserResponse } from '../../service/admin.service';
import { Subscription, interval, startWith, switchMap, catchError, of, forkJoin, tap } from 'rxjs';
import { LayoutService } from 'src/app/layout/service/app.layout.service';
import { AnalystProjectsService, Dossier } from '../../service/analyst-projects.service';
import { AuthService } from '../../service/auth.service';

@Component({
    templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {

    // --- État de chargement ---
    isInitialLoading: boolean = true;

    // --- Données des 4 Modules ---
    auditStats = { recentEvents: [] as DataEvent[], dailyCount: 0 };
    userStats = { active: 0, total: 0, distribution: [] as number[] };

    // --- Graphiques ---
    productivityData: any;
    productivityOptions: any;
    roleDistributionData: any;
    roleDistributionOptions: any;

    // --- Business KPIs (Analyste/Manager/Admin) ---
    businessStats = {
        totalAnalyses: 0,      // Analystes
        totalDecisions: 0,     // Managers
        auditEvents: 0         // Admins
    };

    private refreshSubscription!: Subscription;

    constructor(
        private adminService: AdminService,
        private analystService: AnalystProjectsService,
        private authService: AuthService,
        public layoutService: LayoutService
    ) {}

    ngOnInit() {
        this.initCharts();
        this.startLiveMonitoring();
    }

    startLiveMonitoring() {
        this.refreshSubscription = interval(8000) // Rafraîchissement toutes les 8s
            .pipe(
                startWith(0),
                switchMap(() => this.loadDashboardData())
            )
            .subscribe();
    }

    loadDashboardData() {
        return forkJoin({
            users: this.authService.getAccounts(0, 1000).pipe(catchError(() => of({ content: [] } as any))),
            audit: this.adminService.getAuditEvents({ size: 10 }).pipe(catchError(() => of({ content: [] } as any))),
            authEvents: this.authService.getEvents({ size: 10 }).pipe(catchError(() => of({ content: [] } as any))),
            dossiers: this.analystService.getAllDossiers().pipe(catchError(() => of([])))
        }).pipe(
            tap(res => {
                // Robust extraction helper
                const extractArray = (data: any) => {
                    if (!data) return [];
                    if (Array.isArray(data)) return data;
                    if (data.content && Array.isArray(data.content)) return data.content;
                    if (data.data && Array.isArray(data.data)) return data.data;
                    return [];
                };

                const usersArr = extractArray(res.users);
                this.processUserData(usersArr);
                
                const auditArr = extractArray(res.audit);
                const authArr = extractArray(res.authEvents);
                
                // Combine both admin data events and auth access events
                const combinedAudit = [...auditArr, ...authArr]
                    .sort((a: any, b: any) => {
                        const dateA = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
                        const dateB = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
                        return dateB - dateA;
                    });
                this.processAuditData(combinedAudit);
                
                const dossiersArr = extractArray(res.dossiers);
                this.processBusinessData(dossiersArr);
                
                this.updateCharts();
                this.isInitialLoading = false;
            })
        );
    }

    private processUserData(users: UserResponse[]) {
        const active = users.filter(u => ['ACTIVE', 'VALIDATED'].includes(u.accountStatus || u.status || '')).length;
        this.userStats.active = active;
        this.userStats.total = users.length;
        
        let analysts = 0, managers = 0, admins = 0;
        users.forEach(u => {
            let roleStr = '';
            if (typeof u.role === 'string') {
                roleStr = u.role.toUpperCase();
            } else if (u.role && (u.role as any).code) {
                roleStr = (u.role as any).code.toUpperCase();
            } else if ((u as any).roleCode) {
                roleStr = (u as any).roleCode.toUpperCase();
            } else if ((u as any).roles && Array.isArray((u as any).roles)) {
                roleStr = (u as any).roles.map((r: any) => typeof r === 'string' ? r : (r.code || '')).join(',').toUpperCase();
            }

            if (roleStr.includes('ANALYST') || roleStr.includes('ANALYSTE')) analysts++;
            else if (roleStr.includes('MANAGER') || roleStr.includes('DECISION') || roleStr.includes('SUPERVISION')) managers++;
            else admins++; // Fallback pour GUEST ou ADMIN
        });
        
        this.userStats.distribution = [analysts, managers, admins];
    }

    private processAuditData(events: any[]) {
        this.auditStats.recentEvents = events;
        // Mettre à jour le compteur global du dashboard
        this.businessStats.auditEvents = events.length; 
    }

    // --- Variables temporelles pour les graphiques ---
    dailyAnalyses = [0, 0, 0, 0, 0, 0, 0];
    dailyDecisions = [0, 0, 0, 0, 0, 0, 0];
    last7DaysLabels = [] as string[];

    private processBusinessData(dossiers: Dossier[]) {
        this.businessStats.totalAnalyses = dossiers.length;
        
        let decisions = 0;
        this.dailyAnalyses = [0, 0, 0, 0, 0, 0, 0];
        this.dailyDecisions = [0, 0, 0, 0, 0, 0, 0];
        
        const now = new Date();
        this.last7DaysLabels = [];
        for(let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            this.last7DaysLabels.push(d.toLocaleDateString('fr-FR', { weekday: 'short' }));
        }

        dossiers.forEach(d => {
            const s = d.status || '';
            const isDecision = ['NO_GO_CONFIRMED', 'FORCE_GO', 'MATCHING', 'DRAFTING', 'REPORT_GENERATED', 'PACK_READY', 'SUBMITTED', 'ARCHIVED'].includes(s);
            if (isDecision) decisions++;

            // Calcul temporel basé sur updatedAt (ou createdAt)
            const dateStr = d.updatedAt || d.createdAt;
            if (dateStr) {
                const dateDossier = new Date(dateStr);
                const diffTime = Math.abs(now.getTime() - dateDossier.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays <= 7 && diffDays > 0) {
                    const index = 7 - diffDays;
                    this.dailyAnalyses[index]++;
                    if (isDecision) this.dailyDecisions[index]++;
                } else if (diffDays === 0) {
                    this.dailyAnalyses[6]++;
                    if (isDecision) this.dailyDecisions[6]++;
                }
            }
        });
        this.businessStats.totalDecisions = decisions;
    }

    formatAction(action: string): string {
        const map: any = {
            'LOGIN': 'Connexion',
            'REGISTER': 'Inscription',
            'UPDATE_ROLE': 'Droits modifiés',
            'VALIDATE_USER': 'Compte validé',
            'REJECT_USER': 'Accès refusé',
            'TOGGLE_STATUS': 'Statut modifié'
        };
        return map[action] || 'Action système';
    }

    formatResource(resource: string): string {
        const map: any = {
            'AppUser': 'Utilisateur',
            'CredentialAccount': 'Sécurité',
            'ROLE': 'Rôle',
            'PERMISSIONS': 'Permissions'
        };
        return map[resource] || resource || '—';
    }

    initCharts() { }

    updateCharts() {
        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--text-color');
        const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary');

        // --- 1. Bar Chart : Productivité (Analyses vs Décisions) ---
        this.productivityData = {
            labels: this.last7DaysLabels.length > 0 ? this.last7DaysLabels : ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
            datasets: [
                {
                    label: 'Analyses (Analystes)',
                    backgroundColor: '#93C5FD', // Bleu pastel
                    hoverBackgroundColor: '#60A5FA',
                    data: this.dailyAnalyses,
                    borderRadius: 4
                },
                {
                    label: 'Décisions (Managers)',
                    backgroundColor: '#86EFAC', // Vert pastel
                    hoverBackgroundColor: '#4ADE80',
                    data: this.dailyDecisions,
                    borderRadius: 4
                }
            ]
        };

        this.productivityOptions = {
            maintainAspectRatio: false,
            aspectRatio: 0.8,
            plugins: {
                legend: { labels: { color: textColor, usePointStyle: true, font: { weight: '600' } } }
            },
            scales: {
                x: {
                    ticks: { color: textColorSecondary },
                    grid: { display: false }
                },
                y: {
                    ticks: { color: textColorSecondary },
                    grid: { borderDash: [5, 5] }
                }
            }
        };

        // --- 2. Donut Chart : Répartition des rôles ---
        this.roleDistributionData = {
            labels: ['Analystes', 'Managers', 'Admins'],
            datasets: [{
                data: this.userStats.distribution,
                backgroundColor: [
                    '#93C5FD', // Bleu pastel (Analystes)
                    '#FDBA74', // Orange pastel (Managers)
                    '#D8B4FE'  // Violet pastel (Admins)
                ],
                hoverBackgroundColor: [
                    '#60A5FA',
                    '#FB923C',
                    '#C084FC'
                ],
                borderWidth: 0
            }]
        };

        this.roleDistributionOptions = {
            cutout: '75%',
            plugins: { 
                legend: { position: 'bottom', labels: { color: textColor, usePointStyle: true, font: { weight: '600' } } }
            },
            maintainAspectRatio: false
        };
    }

    ngOnDestroy() {
        if (this.refreshSubscription) this.refreshSubscription.unsubscribe();
    }
}
