import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
    templateUrl: './analyst-analyses-logs.component.html',
    providers: [MessageService],
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
    `]
})
export class AnalystAnalysesLogsComponent implements OnInit {

    logs: any[] = [];
    loadingLogs: boolean = false;

    tokenStats = {
        total: 0,
        avgResponseTime: 0,
        totalCost: 0
    };

    displayJsonDialog = false;
    selectedLog: any = null;

    constructor(private http: HttpClient, private messageService: MessageService) {}

    ngOnInit(): void {
        this.loadLogs();
    }

    loadLogs(): void {
        this.loadingLogs = true;

        const phase1$ = this.http.get<any[]>('/api/dossiers/ai-logs').pipe(
            catchError(err => of([]))
        );
        const phase2$ = this.http.get<any>('/api/analyses/audit-ia?page=0&size=50').pipe(
            catchError(err => of({ content: [] }))
        );

        forkJoin([phase1$, phase2$]).subscribe({
            next: ([p1Data, p2Data]) => {
                const logsP1 = p1Data.map(l => ({
                    id: l.id,
                    createdAt: l.createdAt,
                    actionName: l.actionType || 'Extraction Phase 1',
                    tokenUsage: l.tokensConsumed || 0,
                    cacheReadTokens: 0,
                    cacheCreationTokens: 0,
                    processingTimeMs: l.responseTimeMs || 0,
                    estimatedCost: l.estimatedCost || 0,
                    rawJson: l.rawJson || 'Non disponible pour P1',
                    model: l.modelUsed || 'Claude',
                    project: 'Dossier ' + (l.dossierId ? l.dossierId.substring(0,8) : '')
                }));

                const logsP2 = (p2Data.content || p2Data || []).map((l: any) => ({
                    id: l.id,
                    createdAt: l.createdAt,
                    actionName: l.actionName,
                    tokenUsage: l.tokenUsage || 0,
                    cacheReadTokens: l.cacheReadTokens || 0,
                    cacheCreationTokens: l.cacheCreationTokens || 0,
                    processingTimeMs: l.processingTimeMs || 0,
                    estimatedCost: l.estimatedCost || 0,
                    rawJson: l.rawJson || 'Non disponible',
                    model: l.model || 'Claude',
                    project: 'Dossier ' + (l.dossierId ? l.dossierId.substring(0,8) : '')
                }));

                // Combine and sort by date descending
                this.logs = [...logsP1, ...logsP2].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                this.calculateStats();
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

        this.logs.forEach(log => {
            if (log.tokenUsage) totalTokens += log.tokenUsage;
            if (log.processingTimeMs) totalTime += log.processingTimeMs;
            if (log.estimatedCost) totalCost += log.estimatedCost;
        });

        this.tokenStats.total = totalTokens;
        this.tokenStats.totalCost = totalCost;
        this.tokenStats.avgResponseTime = Math.round((totalTime / this.logs.length) / 1000 * 100) / 100; // in seconds
    }

    inspectJson(log: any): void {
        this.selectedLog = log;
        this.displayJsonDialog = true;
    }
}
