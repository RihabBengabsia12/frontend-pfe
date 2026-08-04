import { Component, OnInit, OnDestroy } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { AdminService, DataEvent, UserResponse } from '../../service/admin.service';
import { Subscription, interval, startWith, switchMap, catchError, of, forkJoin, tap } from 'rxjs';
import { LayoutService } from 'src/app/layout/service/app.layout.service';
import { AnalystProjectsService, Dossier } from '../../service/analyst-projects.service';

@Component({
    templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {

    // --- État de chargement ---
    isInitialLoading: boolean = true;

    // --- Données des 4 Modules ---
    validationStats = { pending: 0, processed: 0, total: 0 };
    auditStats = { recentEvents: [] as DataEvent[], dailyCount: 0 };
    userStats = { active: 0, total: 0, distribution: [] as any[] };
    roleStats = { total: 0, active: 0 };
    systemHealth = { global: 'Chargement...', connection: '...', memory: '...' };

    // --- Graphiques ---
    activityData: any;
    activityOptions: any;
    roleDistributionData: any;
    roleDistributionOptions: any;

    // --- Business KPIs (Analyste/Manager) ---
    businessStats = {
        totalDossiers: 0,
        pendingDecision: 0,
        goCount: 0,
        noGoCount: 0,
        forceGoCount: 0,
        anomaliesIA: 0
    };

    pipelineData: any;
    pipelineOptions: any;

    goNoGoData: any;
    goNoGoOptions: any;

    private refreshSubscription!: Subscription;

    constructor(
        private adminService: AdminService,
        private analystService: AnalystProjectsService,
        public layoutService: LayoutService
    ) {}

    ngOnInit() {
        this.initCharts();
        this.startLiveMonitoring();
    }

    startLiveMonitoring() {
        this.refreshSubscription = interval(8000) // Rafraîchissement toutes les 8s pour le côté "Live"
            .pipe(
                startWith(0),
                switchMap(() => this.loadDashboardData())
            )
            .subscribe();
    }

    loadDashboardData() {
        return forkJoin({
            users: this.adminService.getUsers(0, 1000).pipe(catchError(() => of({ content: [] }))),
            audit: this.adminService.getAuditEvents({ size: 6 }).pipe(catchError(() => of({ content: [] }))),
            roles: this.adminService.getRoles().pipe(catchError(() => of([]))),
            health: this.adminService.getHealth().pipe(catchError(() => of({ status: 'DOWN' }))),
            dossiers: this.analystService.getAllDossiers().pipe(catchError(() => of([])))
        }).pipe(
            tap(res => {
                this.processUserData(res.users.content);
                this.processAuditData(res.audit.content);
                this.processRoleData(res.roles);
                this.processHealthData(res.health);
                this.processBusinessData(res.dossiers);
                this.updateCharts(res.users.content);
                this.isInitialLoading = false;
            })
        );
    }

    private processHealthData(health: any) {
        // Traduction des termes techniques en termes "Utilisateur"
        const isOk = health.status === 'UP';
        this.systemHealth = {
            global: isOk ? 'Système Fluide' : 'Maintenance en cours',
            connection: isOk ? 'Prêt' : 'Indisponible',
            memory: isOk ? 'Optimisée' : 'Lenteur détectée'
        };
    }

    private processUserData(users: UserResponse[]) {
        const pending = users.filter(u => (u.accountStatus || u.status) === 'PENDING').length;
        const active = users.filter(u => ['ACTIVE', 'VALIDATED'].includes(u.accountStatus || u.status || '')).length;
        
        this.validationStats = {
            pending: pending,
            processed: users.length - pending,
            total: users.length
        };

        this.userStats = {
            active: active,
            total: users.length,
            distribution: []
        };
    }

    private processAuditData(events: DataEvent[]) {
        this.auditStats.recentEvents = events;
        this.auditStats.dailyCount = events.length; // Simplifié pour le démo
    }

    private processRoleData(roles: any[]) {
        this.roleStats = {
            total: roles.length,
            active: roles.filter(r => r.active !== false).length
        };
    }

    private processBusinessData(dossiers: Dossier[]) {
        this.businessStats.totalDossiers = dossiers.length;
        
        let pending = 0;
        let go = 0;
        let nogo = 0;
        let force = 0;
        let anomalies = 0;

        dossiers.forEach(d => {
            const s = d.status || '';
            // Les anomalies IA peuvent être mesurées si confiance < 0.6 ou boucle de correction
            if (s === 'CORRECTION_LOOP' || (d.confianceP1 && d.confianceP1 < 0.6)) {
                anomalies++;
            }

            if (s === 'PENDING_VALIDATION' || s === 'DEEP_ANALYSIS' || s === 'SCORING') {
                pending++;
            }

            if (s === 'NO_GO_CONFIRMED') {
                nogo++;
            } else if (s === 'FORCE_GO') {
                force++;
            } else if (['MATCHING', 'DRAFTING', 'REPORT_GENERATED', 'PACK_READY', 'SUBMITTED', 'ARCHIVED'].includes(s)) {
                go++;
            }
        });

        this.businessStats.pendingDecision = pending;
        this.businessStats.goCount = go;
        this.businessStats.noGoCount = nogo;
        this.businessStats.forceGoCount = force;
        this.businessStats.anomaliesIA = anomalies;
    }

    formatAction(action: string): string {
        const map: any = {
            'LOGIN': 'Connexion',
            'REGISTER': 'Inscription',
            'UPDATE_ROLE': 'Droits mis à jour',
            'VALIDATE_USER': 'Compte approuvé',
            'REJECT_USER': 'Refus d\'accès',
            'TOGGLE_STATUS': 'Statut changé'
        };
        return map[action] || 'Action système';
    }

    formatResource(resource: string): string {
        const map: any = {
            'AppUser': 'Utilisateur',
            'CredentialAccount': 'Identifiants',
            'ROLE': 'Rôle',
            'PERMISSIONS': 'Permissions'
        };
        return map[resource] || resource || '—';
    }

    initCharts() {
        // Initialisation vide, sera remplie par updateCharts
    }

    updateCharts(users: UserResponse[]) {
        // --- 1. Donut Chart : Go / No-Go / Force Go ---
        const totalDecided = this.businessStats.goCount + this.businessStats.noGoCount + this.businessStats.forceGoCount;
        
        let goPct = 0, nogoPct = 0, forcePct = 0;
        if (totalDecided > 0) {
            goPct = Math.round((this.businessStats.goCount / totalDecided) * 100);
            nogoPct = Math.round((this.businessStats.noGoCount / totalDecided) * 100);
            forcePct = Math.round((this.businessStats.forceGoCount / totalDecided) * 100);
        }

        this.goNoGoData = {
            labels: ['Approuvé (Go)', 'Refusé (No-Go)', 'Forcé (Override)'],
            datasets: [{
                data: [this.businessStats.goCount, this.businessStats.noGoCount, this.businessStats.forceGoCount],
                backgroundColor: ['#22C55E', '#EF4444', '#F59E0B'], // Vert, Rouge, Orange
                hoverBackgroundColor: ['#16A34A', '#DC2626', '#D97706'],
                borderWidth: 0
            }]
        };

        this.goNoGoOptions = {
            cutout: '75%',
            plugins: { 
                legend: { position: 'bottom', labels: { usePointStyle: true, font: { size: 12, weight: 'bold' } } },
                tooltip: {
                    callbacks: {
                        label: function(context: any) {
                            const val = context.raw;
                            const total = context.dataset.data.reduce((a:number, b:number) => a + b, 0);
                            const pct = total === 0 ? 0 : Math.round((val / total) * 100);
                            return ` ${val} Dossiers (${pct}%)`;
                        }
                    }
                }
            },
            maintainAspectRatio: false
        };

        // --- 2. Bar Chart : Pipeline de Production (Histogramme) ---
        this.pipelineData = {
            labels: ['Importés', 'En IA (Score)', 'Décidés', 'Clôturés'],
            datasets: [{
                label: 'Volume de dossiers',
                data: [
                    this.businessStats.totalDossiers,
                    this.businessStats.pendingDecision,
                    totalDecided,
                    this.businessStats.goCount // Estimé clôturés
                ],
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                borderColor: '#3B82F6',
                borderWidth: 1,
                borderRadius: 4
            }]
        };

        this.pipelineOptions = {
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { borderDash: [5, 5] } },
                x: { grid: { display: false } }
            },
            maintainAspectRatio: false
        };
    }

    ngOnDestroy() {
        if (this.refreshSubscription) this.refreshSubscription.unsubscribe();
    }
}
