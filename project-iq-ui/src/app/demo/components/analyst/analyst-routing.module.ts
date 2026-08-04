import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AnalystDashboardComponent } from './dashboard/analyst-dashboard.component';
import { AnalystLancerAnalyseComponent } from './lancer-analyse/analyst-lancer-analyse.component';
import { AnalystDossiersComponent } from './dossiers/analyst-dossiers.component';
import { AnalystRapportsComponent } from './rapports/analyst-rapports.component';
import { AnalystAnalysesLogsComponent } from './analyses-logs/analyst-analyses-logs.component';
import { AnalystConfigIaComponent } from './config-ia/analyst-config-ia.component';
import { DeepAnalysisPageComponent } from './deep-analysis-page/deep-analysis-page.component';
import { ValidationP2PageComponent } from './validation-p2-page/validation-p2-page.component';
import { ScoringPageComponent } from './scoring-page/scoring-page.component';
import { NogoReportPageComponent } from './nogo-report-page/nogo-report-page.component';
import { AnalystMatchingComponent } from './matching-page/analyst-matching.component';
import { UploadPageComponent } from './deposit/upload-page/upload-page.component';
import { ValidationP1PageComponent } from './deposit/validation-p1-page/validation-p1-page.component';
import { ExtractionPageComponent } from './deposit/extraction-page/extraction-page.component';
import { IndexationPageComponent } from './deposit/indexation-page/indexation-page.component';

import { RapportFinalPageComponent } from './rapport-final-page/rapport-final-page.component';
import { ApoEditorPageComponent } from './apo-editor-page/apo-editor-page.component';
import { PackReadyPageComponent } from './pack-ready-page/pack-ready-page.component';
import { AnalystNogoReportsComponent } from './nogo-reports/analyst-nogo-reports.component';
import { AnalystMethodologiesComponent } from './methodologies/analyst-methodologies.component';
import { AnalystAposComponent } from './apos/analyst-apos.component';

@NgModule({
    imports: [RouterModule.forChild([
        // ── Phase 1 — Dépôt (routes statiques AVANT :id) ──
        { path: 'nouveau', component: UploadPageComponent },
        { path: '', component: AnalystDossiersComponent },
        { path: ':id/extraction', component: ExtractionPageComponent },
        { path: ':id/validation-p1', component: ValidationP1PageComponent },
        { path: ':id/indexation', component: IndexationPageComponent },

        // ── Analyst workspace ──
        { path: 'dashboard', component: AnalystDashboardComponent },
        { path: 'lancer-analyse', redirectTo: '/dossiers/nouveau', pathMatch: 'full' },
        { path: 'rapports', component: AnalystRapportsComponent },
        { path: 'methodologies', component: AnalystMethodologiesComponent },
        { path: 'nogo-reports', component: AnalystNogoReportsComponent },
        { path: 'apos', component: AnalystAposComponent },
        { path: 'analyses-logs', component: AnalystAnalysesLogsComponent },
        { path: 'config-ia', component: AnalystConfigIaComponent },

        // ── Pipeline dossier (Phase 2+) ──
        { path: ':id/analyse', component: DeepAnalysisPageComponent },
        { path: ':id/validation-p2', component: ValidationP2PageComponent },
        { path: ':id/scoring', component: ScoringPageComponent },
        { path: ':id/matching', component: AnalystMatchingComponent },
        { path: ':id/no-go-report', component: NogoReportPageComponent },

        // ── Phase 4 — Finalisation APO & Pack ──
        { path: ':id/rapport-final', component: RapportFinalPageComponent },
        { path: ':id/apo-editor', component: ApoEditorPageComponent },
        { path: ':id/pack', component: PackReadyPageComponent }
    ])],
    exports: [RouterModule]
})
export class AnalystRoutingModule { }
