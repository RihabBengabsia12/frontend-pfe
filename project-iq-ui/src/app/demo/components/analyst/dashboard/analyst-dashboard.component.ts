import { Component, OnInit, OnDestroy } from '@angular/core';
import { MessageService } from 'primeng/api';
import {
    AnalystProject,
    AnalystProjectsService, Dossier
} from '../../../../demo/service/analyst-projects.service';
import { interval, Subscription, forkJoin } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { DossierStatusService } from '../../../../demo/service/dossier-status.service';

@Component({
    templateUrl: './analyst-dashboard.component.html',
    styleUrls: ['./analyst-dashboard.component.scss'],
    providers: [MessageService]
})
export class AnalystDashboardComponent implements OnInit, OnDestroy {

    // ── State ────────────────────────────────────────────────────────────────
    isLoading = true;
    lastRefresh: Date = new Date();
    private autoRefreshSub?: Subscription;

    // ── KPI Stats (from backend) ─────────────────────────────────────────────
    totalDossiers = 0;
    totalAnalyses = 0;
    goCount = 0;
    noGoCount = 0;
    manualCount = 0;
    forceGoCount = 0;
    redhibitoireCount = 0;
    tauxReussite = 0;
    avgPwinScore = 0;
    noGoReportsCount = 0;

    // Scores par axe (Radar)
    avgScoreA = 0;
    avgScoreB = 0;
    avgScoreC = 0;
    avgScoreD = 0;
    avgScoreE = 0;

    // Matching
    avgCompetences = 0;
    avgExperts = 0;
    avgRelationClient = 0;
    compatibleCount = 0;
    totalMatching = 0;

    // Recent scores table
    recentScores: any[] = [];

    // Dossier list
    dossiers: Dossier[] = [];

    // Risks
    topRisks: { name: string; count: number }[] = [];

    // ── Charts ───────────────────────────────────────────────────────────────
    decisionDonutData: any;
    decisionDonutOptions: any;
    radarData: any;
    radarOptions: any;
    pwinBarData: any;
    pwinBarOptions: any;
    riskBarData: any;
    riskBarOptions: any;

    // Risk labels for display
    private riskLabels: { [key: string]: string } = {
        'RISQUE_PAYS_SECURITE': 'Pays & Sécurité',
        'RISQUES_FINANCIERS': 'Financiers',
        'PENALITES': 'Pénalités',
        'EXIGENCES_TDR_INACCEPTABLES': 'TDR Inacceptables',
        'GARANTIES_ASSURANCES_ELEVEES': 'Garanties',
        'TAILLE_DISPERSION': 'Taille & Dispersion',
        'FRAIS_DIVERS_ELEVES': 'Frais Divers',
        'BUDGET_FAIBLE_HM_LIMITES': 'Budget / HM',
        'PARTICIPATION_LOCALE_EXCESSIVE': 'Participation Locale',
        'FISCALITE_NON_MAITRISEE': 'Fiscalité'
    };

    constructor(
        private projectsService: AnalystProjectsService,
        private messageService: MessageService,
        private router: Router,
        private statusService: DossierStatusService
    ) {}

    ngOnInit(): void {
        this.loadDashboard();

        // Auto-refresh toutes les 30 secondes
        this.autoRefreshSub = interval(30000).pipe(
            switchMap(() => this.projectsService.getDashboardStats())
        ).subscribe({
            next: (stats) => {
                if (stats) {
                    this.applyStats(stats);
                    this.lastRefresh = new Date();
                }
            }
        });
    }

    ngOnDestroy(): void {
        this.autoRefreshSub?.unsubscribe();
    }

    loadDashboard(): void {
        this.isLoading = true;

        forkJoin({
            stats: this.projectsService.getDashboardStats(),
            dossiers: this.projectsService.getAllDossiers()
        }).subscribe({
            next: ({ stats, dossiers }) => {
                this.dossiers = Array.isArray(dossiers) ? dossiers : [];

                if (stats) {
                    this.applyStats(stats);
                } else {
                    // Fallback: calculer les stats depuis les dossiers
                    this.computeStatsFromDossiers();
                }

                this.isLoading = false;
                this.lastRefresh = new Date();
            },
            error: () => {
                this.isLoading = false;
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Dashboard',
                    detail: 'Impossible de charger les statistiques',
                    life: 4000
                });
            }
        });
    }

    // ── Apply backend stats ──────────────────────────────────────────────────

    private applyStats(stats: any): void {
        this.totalDossiers       = stats.totalDossiers ?? 0;
        this.totalAnalyses       = stats.totalAnalyses ?? 0;
        this.goCount             = stats.goCount ?? 0;
        this.noGoCount           = stats.noGoCount ?? 0;
        this.manualCount         = stats.manualCount ?? 0;
        this.forceGoCount        = stats.forceGoCount ?? 0;
        this.redhibitoireCount   = stats.redhibitoireCount ?? 0;
        this.tauxReussite        = stats.tauxReussite ?? 0;
        this.avgPwinScore        = stats.avgPwinScore ?? 0;
        this.noGoReportsCount    = stats.noGoReportsCount ?? 0;

        this.avgScoreA = stats.avgScoreA ?? 0;
        this.avgScoreB = stats.avgScoreB ?? 0;
        this.avgScoreC = stats.avgScoreC ?? 0;
        this.avgScoreD = stats.avgScoreD ?? 0;
        this.avgScoreE = stats.avgScoreE ?? 0;

        this.avgCompetences    = stats.avgCompetences ?? 0;
        this.avgExperts        = stats.avgExperts ?? 0;
        this.avgRelationClient = stats.avgRelationClient ?? 0;
        this.compatibleCount   = stats.compatibleCount ?? 0;
        this.totalMatching     = stats.totalMatching ?? 0;

        this.recentScores = stats.recentScores ?? [];

        // Top risks
        if (stats.topRisks) {
            this.topRisks = Object.entries(stats.topRisks)
                .map(([key, count]) => ({
                    name: this.riskLabels[key] || key,
                    count: count as number
                }))
                .slice(0, 5);
        }

        this.buildCharts(stats);
    }

    private computeStatsFromDossiers(): void {
        this.totalDossiers = this.dossiers.length;
        const withScore = this.dossiers.filter(d => d.pwinScore != null && d.pwinScore > 0);
        this.avgPwinScore = withScore.length > 0
            ? Math.round(withScore.reduce((sum, d) => sum + (d.pwinScore || 0), 0) / withScore.length * 10) / 10
            : 0;

        const active = this.dossiers.filter(d => !['NO_GO_CONFIRMED', 'ARCHIVED'].includes(d.status));
        this.manualCount = active.length;

        // Fallback distribution
        const pwinDist: any = { '0-20': 0, '20-40': 0, '40-60': 0, '60-80': 0, '80-100': 0 };
        withScore.forEach(d => {
            const s = d.pwinScore!;
            if (s < 20) pwinDist['0-20']++;
            else if (s < 40) pwinDist['20-40']++;
            else if (s < 60) pwinDist['40-60']++;
            else if (s < 80) pwinDist['60-80']++;
            else pwinDist['80-100']++;
        });

        this.buildCharts({ pwinDistribution: pwinDist });
    }

    // ── Build Charts ─────────────────────────────────────────────────────────

    private buildCharts(stats: any): void {
        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--text-color') || '#495057';
        const surfaceBorder = documentStyle.getPropertyValue('--surface-border') || '#dee2e6';

        // ── Decision Donut ───────────────────────────────────────────────
        this.decisionDonutData = {
            labels: ['GO', 'GO Conditionnel', 'Intervention Manuelle', 'NO-GO'],
            datasets: [{
                data: [
                    stats?.decisions?.GO ?? this.goCount,
                    stats?.decisions?.GO_CONDITIONNEL ?? 0,
                    stats?.decisions?.MANUAL ?? this.manualCount,
                    stats?.decisions?.NO_GO ?? this.noGoCount
                ],
                backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'],
                hoverBackgroundColor: ['#16a34a', '#2563eb', '#d97706', '#dc2626'],
                borderWidth: 0
            }]
        };
        this.decisionDonutOptions = {
            plugins: {
                legend: {
                    labels: { color: textColor, font: { weight: '600', size: 12 }, padding: 16 },
                    position: 'bottom'
                }
            },
            cutout: '65%',
            responsive: true,
            maintainAspectRatio: false
        };

        // ── Radar Chart (5 Axes) ─────────────────────────────────────────
        this.radarData = {
            labels: ['Faisabilité', 'Rentabilité', 'Risques', 'Concurrence', 'Conformité'],
            datasets: [{
                label: 'Score Moyen',
                data: [
                    +(this.avgScoreA * 100).toFixed(1),
                    +(this.avgScoreB * 100).toFixed(1),
                    +(this.avgScoreC * 100).toFixed(1),
                    +(this.avgScoreD * 100).toFixed(1),
                    +(this.avgScoreE * 100).toFixed(1)
                ],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#3b82f6',
                borderWidth: 2,
                pointRadius: 5
            }]
        };
        this.radarOptions = {
            plugins: {
                legend: { display: false }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { stepSize: 25, color: textColor, backdropColor: 'transparent', font: { size: 10 } },
                    grid: { color: surfaceBorder },
                    pointLabels: { color: textColor, font: { size: 12, weight: '600' } }
                }
            },
            responsive: true,
            maintainAspectRatio: false
        };

        // ── P-Win Distribution Bar ───────────────────────────────────────
        const pwinDist = stats?.pwinDistribution;
        this.pwinBarData = {
            labels: ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'],
            datasets: [{
                label: 'Dossiers',
                data: pwinDist
                    ? [pwinDist['0-20'] ?? 0, pwinDist['20-40'] ?? 0, pwinDist['40-60'] ?? 0, pwinDist['60-80'] ?? 0, pwinDist['80-100'] ?? 0]
                    : [0, 0, 0, 0, 0],
                backgroundColor: ['#ef4444', '#f59e0b', '#eab308', '#3b82f6', '#22c55e'],
                borderRadius: 8,
                borderSkipped: false,
                barThickness: 28
            }]
        };
        this.pwinBarOptions = {
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: textColor, font: { size: 11 } }, grid: { display: false } },
                y: { ticks: { color: textColor, stepSize: 1 }, grid: { color: surfaceBorder } }
            },
            responsive: true,
            maintainAspectRatio: false
        };

        // ── Risk Bar Chart ───────────────────────────────────────────────
        if (this.topRisks.length > 0) {
            this.riskBarData = {
                labels: this.topRisks.map(r => r.name),
                datasets: [{
                    label: 'Occurrences Élevé/Rédhibitoire',
                    data: this.topRisks.map(r => r.count),
                    backgroundColor: '#ef4444',
                    borderRadius: 6,
                    barThickness: 22
                }]
            };
            this.riskBarOptions = {
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: textColor, stepSize: 1 }, grid: { color: surfaceBorder } },
                    y: { ticks: { color: textColor, font: { size: 11, weight: '500' } }, grid: { display: false } }
                },
                responsive: true,
                maintainAspectRatio: false
            };
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    get dossiersActifs(): number {
        return this.dossiers.filter(d => !['NO_GO_CONFIRMED', 'ARCHIVED'].includes(d.status)).length;
    }

    get dossiersUrgents(): number {
        return this.dossiers.filter(d => d.priorite === 1 && !['NO_GO_CONFIRMED', 'ARCHIVED'].includes(d.status)).length;
    }

    get dossiersProchesDeadline(): number {
        return this.dossiers.filter(d =>
            d.joursOuvrables != null && d.joursOuvrables <= 7 &&
            !['NO_GO_CONFIRMED', 'ARCHIVED'].includes(d.status)
        ).length;
    }

    get latestDossiers(): Dossier[] {
        return [...this.dossiers]
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
            .slice(0, 8);
    }

    get axeLabel(): string {
        const axes = [
            { name: 'Faisabilité', score: this.avgScoreA },
            { name: 'Rentabilité', score: this.avgScoreB },
            { name: 'Risques', score: this.avgScoreC },
            { name: 'Concurrence', score: this.avgScoreD },
            { name: 'Conformité', score: this.avgScoreE }
        ];
        const weakest = axes.reduce((min, a) => a.score < min.score ? a : min, axes[0]);
        return weakest.name;
    }

    pwinColor(score: number): string {
        if (score >= 70) return '#22c55e';
        if (score >= 40) return '#f59e0b';
        return '#ef4444';
    }

    statusLabel(status: string): string {
        return this.statusService.statusLabel(status);
    }

    statusSeverity(status: string): 'success' | 'warning' | 'info' | 'danger' {
        return this.statusService.statusSeverity(status) as any;
    }

    decisionLabel(decision: string): string {
        const labels: { [key: string]: string } = {
            'GO': 'GO ✓', 'GO_CONDITIONNEL': 'GO Cond.',
            'MANUAL': 'Intervention', 'NO_GO': 'NO-GO ✗'
        };
        return labels[decision] || decision || '—';
    }

    decisionSeverity(decision: string): 'success' | 'warning' | 'info' | 'danger' {
        if (decision === 'GO') return 'success';
        if (decision === 'GO_CONDITIONNEL') return 'info';
        if (decision === 'MANUAL') return 'warning';
        if (decision === 'NO_GO') return 'danger';
        return 'info';
    }

    refreshDashboard(): void {
        this.loadDashboard();
        this.messageService.add({
            severity: 'info',
            summary: 'Actualisation',
            detail: 'Données mises à jour',
            life: 2000
        });
    }

    openDossier(d: Dossier): void {
        localStorage.setItem('lastProjectId', d.id);
        this.router.navigate(this.statusService.resolveRoute(d));
    }
}
