import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ScoringService } from './scoring.service';
import { AnalystProjectsService } from './analyst-projects.service';

export interface NoGoReport {
    projectId: string;
    projectTitle: string;
    pwinScore: number;
    reasons: string[];
    narrativeAnalysis: string;
    rapportPath?: string;
}

@Injectable({ providedIn: 'root' })
export class NogoService {

    private readonly SCORING = '/api/scoring';

    constructor(
        private http: HttpClient,
        private scoringService: ScoringService,
        private projectsService: AnalystProjectsService
    ) {}

    /** Build the No-Go report view from the scoring result */
    getNoGoReport(dossierId: string): Observable<NoGoReport> {
        return this.scoringService.getResult(dossierId).pipe(
            map(pwin => ({
                projectId:         dossierId,
                projectTitle:      '',
                pwinScore:         pwin.scoreGlobal,
                reasons:           pwin.motifNogo ? [pwin.motifNogo] : [],
                narrativeAnalysis: pwin.recommendation || pwin.motifNogo || 'Rapport non disponible.'
            }))
        );
    }

    /** Confirm No-Go and archive dossier — also generates the DOCX */
    closeDossier(dossierId: string, commentaire?: string): Observable<any> {
        return this.scoringService.confirmNoGo(dossierId, commentaire);
    }

    /** Force Phase 3 from No-Go report page */
    forcePhase3(dossierId: string, type: string, justification: string): Observable<any> {
        return this.scoringService.forceGo(dossierId, justification, type, 'Direction');
    }

    /** Download the generated No-Go DOCX report */
    downloadReport(dossierId: string): Observable<Blob> {
        return this.http.get(`${this.SCORING}/${dossierId}/nogo-report/download`, { responseType: 'blob' });
    }
}
