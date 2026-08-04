import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnalystRoutingModule } from './analyst-routing.module';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { AnalystDashboardComponent } from './dashboard/analyst-dashboard.component';
import { AnalystLancerAnalyseComponent } from './lancer-analyse/analyst-lancer-analyse.component';
import { AnalystDossiersComponent } from './dossiers/analyst-dossiers.component';
import { AnalystRapportsComponent } from './rapports/analyst-rapports.component';
import { AnalystMethodologiesComponent } from './methodologies/analyst-methodologies.component';
import { AnalystAposComponent } from './apos/analyst-apos.component';
import { AnalystAnalysesLogsComponent } from './analyses-logs/analyst-analyses-logs.component';
import { AnalystConfigIaComponent } from './config-ia/analyst-config-ia.component';
import { DeepAnalysisPageComponent } from './deep-analysis-page/deep-analysis-page.component';
import { RiskEvaluatorComponent } from './deep-analysis-page/risk-evaluator/risk-evaluator.component';
import { RiskLevelSelectorComponent } from './deep-analysis-page/risk-level-selector/risk-level-selector.component';
import { ContractDetailsComponent } from './deep-analysis-page/contract-details/contract-details.component';
import { EligibilityPanelComponent } from './deep-analysis-page/eligibility-panel/eligibility-panel.component';
import { ValidationP2PageComponent } from './validation-p2-page/validation-p2-page.component';
import { ScoringPageComponent } from './scoring-page/scoring-page.component';
import { PwinGaugeComponent } from './scoring-page/pwin-gauge/pwin-gauge.component';
import { ScoreBreakdownComponent } from './scoring-page/score-breakdown/score-breakdown.component';
import { ForceGoModalComponent } from './scoring-page/force-go-modal/force-go-modal.component';
import { NogoReportPageComponent } from './nogo-report-page/nogo-report-page.component';
import { ForceOverrideModalComponent } from './nogo-report-page/force-override-modal/force-override-modal.component';
import { PipelineStepperComponent } from './shared/pipeline-stepper/pipeline-stepper.component';
import { AnalystMatchingComponent } from './matching-page/analyst-matching.component';
import { UploadPageComponent } from './deposit/upload-page/upload-page.component';
import { ValidationP1PageComponent } from './deposit/validation-p1-page/validation-p1-page.component';
import { ExtractionPageComponent } from './deposit/extraction-page/extraction-page.component';
import { IndexationPageComponent } from './deposit/indexation-page/indexation-page.component';
import { ApoPreviewComponent } from './shared/apo-preview/apo-preview.component';
import { AnalystNogoReportsComponent } from './nogo-reports/analyst-nogo-reports.component';

import { RapportFinalPageComponent } from './rapport-final-page/rapport-final-page.component';
import { ApoEditorPageComponent } from './apo-editor-page/apo-editor-page.component';
import { ApoFieldComponent } from './apo-editor-page/apo-field.component';
import { PackReadyPageComponent } from './pack-ready-page/pack-ready-page.component';

import { AccordionModule } from 'primeng/accordion';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { TagModule } from 'primeng/tag';
import { ChartModule } from 'primeng/chart';
import { ProgressBarModule } from 'primeng/progressbar';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SliderModule } from 'primeng/slider';
import { CheckboxModule } from 'primeng/checkbox';
import { KnobModule } from 'primeng/knob';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { CardModule } from 'primeng/card';
import { TabViewModule } from 'primeng/tabview';
import { StepsModule } from 'primeng/steps';
import { CalendarModule } from 'primeng/calendar';
import { SkeletonModule } from 'primeng/skeleton';

import { SidebarModule } from 'primeng/sidebar';
import { MenuModule } from 'primeng/menu';
import { PromptOverrideComponent } from './shared/prompt-override/prompt-override.component';

@NgModule({
    schemas: [NO_ERRORS_SCHEMA],
    imports: [
        CommonModule,
        FormsModule,
        AnalystRoutingModule,

        TableModule,
        ButtonModule,
        InputTextModule,
        InputTextareaModule,
        DropdownModule,
        TagModule,
        ChartModule,
        ProgressBarModule,
        ProgressSpinnerModule,
        RadioButtonModule,
        SliderModule,
        CheckboxModule,
        KnobModule,
        ToastModule,
        DialogModule,
        TooltipModule,
        DividerModule,
        CardModule,
        TabViewModule,
        StepsModule,
        CalendarModule,
        AccordionModule,
        SkeletonModule,
        SidebarModule,
        MenuModule
    ],
    declarations: [
        AnalystDashboardComponent,
        AnalystLancerAnalyseComponent,
        AnalystDossiersComponent,
        AnalystRapportsComponent,
        AnalystMethodologiesComponent,
        AnalystAnalysesLogsComponent,
        AnalystConfigIaComponent,
        DeepAnalysisPageComponent,
        ContractDetailsComponent,
        EligibilityPanelComponent,
        RiskEvaluatorComponent,
        RiskLevelSelectorComponent,
        ValidationP2PageComponent,
        ScoringPageComponent,
        PwinGaugeComponent,
        ScoreBreakdownComponent,
        ForceGoModalComponent,
        NogoReportPageComponent,
        ForceOverrideModalComponent,
        PipelineStepperComponent,
        AnalystMatchingComponent,
        UploadPageComponent,
        ValidationP1PageComponent,
        ExtractionPageComponent,
        IndexationPageComponent,
        ApoPreviewComponent,
        RapportFinalPageComponent,
        ApoEditorPageComponent,
        ApoFieldComponent,
        PackReadyPageComponent,
        AnalystNogoReportsComponent,
        PromptOverrideComponent,
        AnalystAposComponent
    ]
})
export class AnalystModule { }
