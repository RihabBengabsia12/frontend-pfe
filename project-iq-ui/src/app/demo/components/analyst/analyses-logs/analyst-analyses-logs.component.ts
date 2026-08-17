import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AnalystProjectsService, Dossier } from '../../../service/analyst-projects.service';

@Component({
    templateUrl: './analyst-analyses-logs.component.html',
    providers: [],
    styles: [`
        .json-viewer {
            background: #0f172a;
            color: #38bdf8;
            font-family: 'Courier New', Courier, monospace;
            padding: 1.5rem;
            border-radius: 8px;
            max-height: 400px;
            overflow-y: auto;
            white-space: pre-wrap;
            border: 1px solid #334155;
        }
        .logs-header-card {
            background: rgba(219, 234, 254, 0.32);
            border: 1px solid rgba(147, 197, 253, 0.50);
        }
        .logs-header-icon {
            background: rgba(255, 255, 255, 0.50);
        }
        .logs-kpi-card { min-height: 112px; }
        :host ::ng-deep .logs-table-card .p-datatable-thead > tr > th {
            font-size: 0.72rem;
            padding: 0.55rem 0.65rem;
            white-space: nowrap;
        }
        :host ::ng-deep .logs-table-card .p-datatable-tbody > tr > td {
            font-size: 0.72rem;
            padding: 0.45rem 0.65rem;
            white-space: nowrap;
        }
        :host ::ng-deep .logs-table-card .p-rowgroup-header > td {
            padding: 0.5rem 0.65rem;
        }
        :host ::ng-deep .logs-table-card .p-tag {
            font-size: 0.64rem;
            padding: 0.2rem 0.4rem;
        }
    `]
})
export class AnalystAnalysesLogsComponent implements OnInit {

    logs: any[] = [];
    loadingLogs: boolean = false;

    tokenStats = {
        total: 0,
        avgResponseTime: 0,
        totalCost: 0,
        costedCalls: 0
    };
    lastLoadedAt: Date | null = null;

    displayJsonDialog = false;
    selectedLog: any = null;

    dossierMapObj: Map<string, any> = new Map();
    projectStats: { [key: string]: { cost: number, time: number, input: number, output: number, cacheRead: number, cacheWrite: number } } = {};

    constructor(
        private http: HttpClient, 
        private messageService: MessageService,
        private projectsService: AnalystProjectsService
    ) {}

    ngOnInit(): void {
        this.loadLogs();
    }

    loadLogs(): void {
        this.loadingLogs = true;

        const phase1$ = this.http.get<any[]>('/api/dossiers/ai-logs').pipe(
            catchError(err => of([]))
        );
        const phase2$ = this.http.get<any>('/api/analyses/audit-ia?page=0&size=10000').pipe(
            catchError(err => of({ content: [] }))
        );
        const dossiers$ = this.projectsService.getAllDossiers().pipe(
            catchError(err => of([]))
        );

        forkJoin({
            p1Data: phase1$,
            p2Data: phase2$,
            dossiers: dossiers$
        }).subscribe({
            next: ({ p1Data, p2Data, dossiers }) => {
                const dossierMap = new Map((dossiers || []).map(d => [d.id, d.intituleOffre]));
                this.dossierMapObj = new Map((dossiers || []).map(d => [d.id, d]));

                const logsP1 = (p1Data || [])
                    .filter(l => !l.status || l.status === 'SUCCESS')
                    .map(l => ({
                    id: `p1-${l.id}`,
                    dossierId: l.dossierId,
                    projectKey: l.dossierId || `p1-${l.id}`,
                    createdAt: l.createdAt,
                    actionName: l.actionType || 'Extraction Phase 1',
                    tokenUsage: this.toNumber(l.tokensConsumed),
                    inputTokens: this.toNumber(l.inputTokens),
                    outputTokens: this.toNumber(l.outputTokens),
                    cacheReadTokens: 0,
                    cacheCreationTokens: 0,
                    processingTimeMs: this.toNumber(l.responseTimeMs),
                    estimatedCost: this.toNumber(l.estimatedCost),
                    rawJson: l.rawJson || 'Non disponible pour P1',
                    model: l.modelUsed || 'Claude',
                    project: this.projectLabel(l.dossierId, dossierMap),
                }));

                const logsP2 = (p2Data?.content || p2Data || []).map((l: any) => ({
                    id: `p2-${l.id}`,
                    dossierId: l.dossierId,
                    projectKey: l.dossierId || `p2-${l.id}`,
                    createdAt: l.createdAt,
                    actionName: l.actionName,
                    tokenUsage: this.toNumber(l.tokenUsage),
                    inputTokens: this.toNumber(l.inputTokens),
                    outputTokens: this.toNumber(l.outputTokens),
                    cacheReadTokens: this.toNumber(l.cacheReadTokens),
                    cacheCreationTokens: this.toNumber(l.cacheCreationTokens),
                    processingTimeMs: this.toNumber(l.processingTimeMs),
                    estimatedCost: this.toNumber(l.estimatedCost),
                    rawJson: l.rawJson || 'Non disponible',
                    model: l.model || 'Claude',
                    project: this.projectLabel(l.dossierId, dossierMap),
                }));

                // Combine and sort by date descending
                this.logs = [...logsP1, ...logsP2].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                this.calculateStats();
                this.lastLoadedAt = new Date();
                this.loadingLogs = false;
            },
            error: (err) => {
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger l\'audit.' });
                this.loadingLogs = false;
            }
        });
    }

    calculateStats(): void {
        if (!this.logs || this.logs.length === 0) return;

        let totalTokens = 0;
        let totalTime = 0;
        let totalCost = 0;

        this.projectStats = {};
        this.tokenStats.costedCalls = 0;

        this.logs.forEach(log => {
            totalTokens += this.getActualTokens(log);
            totalTime += this.toNumber(log.processingTimeMs);
            if (log.estimatedCost > 0) {
                totalCost += log.estimatedCost;
                this.tokenStats.costedCalls++;
            }

            const proj = log.projectKey;
            if (!this.projectStats[proj]) {
                this.projectStats[proj] = { cost: 0, time: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
            }
            this.projectStats[proj].time += this.toNumber(log.processingTimeMs);
            this.projectStats[proj].cost += this.toNumber(log.estimatedCost);
            this.projectStats[proj].input += this.toNumber(log.inputTokens);
            this.projectStats[proj].output += this.toNumber(log.outputTokens);
            this.projectStats[proj].cacheRead += this.toNumber(log.cacheReadTokens);
            this.projectStats[proj].cacheWrite += this.toNumber(log.cacheCreationTokens);
        });

        this.tokenStats.total = totalTokens;
        this.tokenStats.totalCost = totalCost;
        this.tokenStats.avgResponseTime = Math.round((totalTime / this.logs.length) / 1000 * 100) / 100; // in seconds
    }

    private toNumber(value: unknown): number {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    }

    getActualTokens(log: any): number {
        const detailed = this.toNumber(log.inputTokens)
            + this.toNumber(log.outputTokens)
            + this.toNumber(log.cacheReadTokens)
            + this.toNumber(log.cacheCreationTokens);
        return detailed > 0 ? detailed : this.toNumber(log.tokenUsage);
    }

    private projectLabel(dossierId: string | undefined, dossierMap: Map<string, string>): string {
        const title = dossierId ? dossierMap.get(dossierId) : undefined;
        const reference = dossierId ? dossierId.substring(0, 8) : 'inconnu';
        return `${title || 'Dossier'} · ${reference}`;
    }

    inspectJson(log: any): void {
        this.selectedLog = log;
        this.displayJsonDialog = true;
    }

    viewFullDossierJson(dossierId: string): void {
        const dossierLogs = this.logs.filter(l => l.dossierId === dossierId && l.rawJson && !l.rawJson.includes('Non disponible'));
        
        let combinedRawJson: any = {};
        
        // On trie du plus ancien au plus récent pour fusionner dans l'ordre chronologique
        const sortedLogs = [...dossierLogs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        sortedLogs.forEach(log => {
            if (log.actionName && (log.actionName.includes('EXTRACTION') || log.actionName.includes('Extraction'))) {
                try {
                    const parsed = typeof log.rawJson === 'string' ? JSON.parse(log.rawJson) : log.rawJson;
                    combinedRawJson = { ...combinedRawJson, ...parsed };
                } catch (e) {
                    // Ignore non-json ou malformé
                }
            }
        });

        const projectName = this.dossierMapObj.get(dossierId)?.intituleOffre || 'Dossier';

        if (Object.keys(combinedRawJson).length > 0) {
            this.selectedLog = {
                project: projectName,
                rawJson: combinedRawJson,
                model: 'Fusion Claude (Phases 1, 2, 3)'
            };
            this.displayJsonDialog = true;
        } else {
            // Fallback sur le dossier de la BD si on n'a pas les logs d'extraction
            this.projectsService.getDossier(dossierId).subscribe({
                next: (fullDossier) => {
                    this.selectedLog = {
                        project: fullDossier.intituleOffre || 'Dossier',
                        rawJson: fullDossier,
                        model: 'Base de Données Centrale'
                    };
                    this.displayJsonDialog = true;
                },
                error: () => {
                    this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Aucune donnée brute Claude trouvée pour ce dossier.' });
                }
            });
        }
    }

    getFormattedJson(raw: any): string {
        if (!raw) return 'Aucune donnée';
        try {
            const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return JSON.stringify(obj, null, 2);
        } catch (e) {
            return String(raw);
        }
    }
}
