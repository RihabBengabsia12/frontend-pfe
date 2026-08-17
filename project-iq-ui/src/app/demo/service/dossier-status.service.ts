import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, interval, of } from 'rxjs';
import { catchError, map, switchMap, takeWhile, tap } from 'rxjs/operators';
import { AnalystProjectsService, Dossier, DossierStatus } from './analyst-projects.service';

export interface DossierStatusPoll {
    dossierId: string;
    status: DossierStatus;
    pwinScore: number | string;
    joursOuvrables: number;
    priorite: number;
}

/** Pipeline Phase 1 — ordre canonique (source de vérité backend) */
export const PHASE1_PIPELINE: DossierStatus[] = [
    'UPLOADED', 'PARSING_INITIAL', 'CORRECTION_LOOP', 'INDEXED'
];

@Injectable({ providedIn: 'root' })
export class DossierStatusService {

    constructor(
        private projectsService: AnalystProjectsService,
        private router: Router
    ) {}

    pollStatus(dossierId: string, intervalMs = 5000): Observable<DossierStatusPoll> {
        return this.projectsService.pollStatus(dossierId).pipe(
            map(resp => ({
                dossierId: resp.dossierId ?? dossierId,
                status: resp.status as DossierStatus,
                pwinScore: resp.pwinScore,
                joursOuvrables: resp.joursOuvrables ?? 0,
                priorite: resp.priorite ?? 2
            }))
        );
    }

    /**
     * Polling post-upload : attend PARSING_INITIAL → lance analyze → attend CORRECTION_LOOP.
     * Règle : navigation pilotée par le statut backend uniquement.
     */
    watchUploadPipeline(
        dossierId: string,
        onStatus?: (s: DossierStatusPoll) => void
    ): Observable<DossierStatusPoll> {
        return interval(5000).pipe(
            switchMap(() => this.pollStatus(dossierId)),
            tap(resp => onStatus?.(resp)),
            takeWhile(
                resp => resp.status !== 'CORRECTION_LOOP' && resp.status !== 'INDEXED',
                true
            )
        );
    }

    /** Route cible selon le statut dossier (jamais d'état local Angular) */
    resolveRoute(dossier: Dossier): string[] {
        const id = dossier.id;
        switch (dossier.status) {
            case 'UPLOADED':
                return ['/dossiers', 'nouveau'];
            case 'PARSING_INITIAL':
            case 'CORRECTION_LOOP':
                return ['/dossiers', id, 'validation-p1'];
            case 'INDEXED':
                // P1 validé → aller en P2 (extraction approfondie)
                return ['/dossiers', id, 'validation-p2'];
            case 'DEEP_ANALYSIS':
                // P2 en cours → rester sur validation-p2
                return ['/dossiers', id, 'validation-p2'];
            case 'SCORING':
            case 'FORCE_GO':
            case 'MANUAL_INTERVENTION':
                // P2 validé → scoring
                return ['/dossiers', id, 'scoring'];
            case 'NO_GO_CONFIRMED':
                // No-Go → rapport no-go
                return ['/dossiers', id, 'no-go-report'];
            case 'MATCHING':
                // Scoring OK → matching
                return ['/dossiers', id, 'matching'];
            case 'DRAFTING':
            case 'REPORT_GENERATED':
            case 'PACK_READY':
                return ['/dossiers', id, 'rapport-final'];
            case 'AUDIT':
            case 'ARCHIVED':
                return ['/dossiers', id, 'audit'];
            default:
                return ['/dossiers'];
        }
    }

    navigateForStatus(dossier: Dossier): void {
        this.router.navigate(this.resolveRoute(dossier));
    }

    statusLabel(status: string): string {
        const labels: Record<string, string> = {
            UPLOADED: 'Importé',
            PARSING_INITIAL: 'Extraction IA',
            CORRECTION_LOOP: 'Validation',
            INDEXED: 'Indexé',
            DEEP_ANALYSIS: 'Analyse P2',
            SCORING: 'Scoring',
            MANUAL_INTERVENTION: 'Intervention',
            FORCE_GO: 'Force-Go',
            NO_GO_CONFIRMED: 'No-Go',
            MATCHING: 'Matching',
            DRAFTING: 'Rédaction',
            REPORT_GENERATED: 'Rapport',
            PACK_READY: 'Pack Prêt',
            PENDING_VALIDATION: 'Validation',
            SUBMITTED: 'Soumis',
            AUDIT: 'Audit',
            ARCHIVED: 'Archivé'
        };
        return labels[(status || '').toUpperCase()] || status || '—';
    }

    statusSeverity(status: string): 'success' | 'warning' | 'info' | 'danger' | 'secondary' {
        const s = (status || '').toUpperCase();
        if (['INDEXED', 'PACK_READY', 'SUBMITTED', 'ARCHIVED', 'SCORING'].includes(s)) return 'success';
        if (['CORRECTION_LOOP', 'PARSING_INITIAL', 'DEEP_ANALYSIS', 'MATCHING', 'MANUAL_INTERVENTION', 'FORCE_GO'].includes(s)) return 'warning';
        if (['NO_GO_CONFIRMED'].includes(s)) return 'danger';
        return 'info';
    }

    phase1ProgressIndex(status: DossierStatus): number {
        const idx = PHASE1_PIPELINE.indexOf(status);
        return idx >= 0 ? idx : 0;
    }
}
