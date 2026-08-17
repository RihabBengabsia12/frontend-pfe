import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Subscription } from 'rxjs';
import {
    AnalystProjectsService,
    ExtractionMetadata,
    ValidateP1RequestDto
} from '../../../../service/analyst-projects.service';
import { DossierStatusService } from '../../../../service/dossier-status.service';
import { AiLogsService, AiLog } from '../../../../service/ai-logs.service';
export interface P1Field {
    id: string;
    label: string;
    value: any;
    type: 'select' | 'date' | 'input' | 'number' | 'money';
    confidence: number;
    validated: boolean;
    editing: boolean;
    humanModified: boolean;
    sourceText: string;
    options?: string[];
    amount?: number;
    currency?: string;
    expanded?: boolean;
}

@Component({
    selector: 'app-validation-p1-page',
    templateUrl: './validation-p1-page.component.html',
    styleUrls: ['./validation-p1-page.component.scss'],
    providers: []
})
export class ValidationP1PageComponent implements OnInit, OnDestroy {

    dossierId = '';
    dossierTitle = '';
    dossierStatus = '';
    joursRestants = 0;
    isLoading = true;
    isWaitingForAI = false;
    isSubmitting = false;
    isConsultation = false;
    isFinalLocked = false;

    fields: P1Field[] = [];
    tjmImplicite: number | null = null;
    tjmAlert = false;
    visiteAlert = false;

    // APO Preview Toggle
    showApoPreview = false;

    private routeSub?: Subscription;
    private pollSub?: Subscription;



    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private projectsService: AnalystProjectsService,
        private statusService: DossierStatusService,
        private messageService: MessageService,
        private aiLogsService: AiLogsService
    ) { }

    // AI Logs Dialog state
    displayAiLogsDialog = false;
    aiLogs: AiLog[] = [];
    aiLogsLoading = false;
    aiLogsStats = { totalTokens: 0, totalCost: 0, totalTime: 0 };
    currencies = ['TND', 'EUR', 'USD', 'GBP', 'XOF', 'MAD', 'DZD', 'Autre'];

    ngOnInit(): void {
        this.routeSub = this.route.params.subscribe(params => {
            this.dossierId = params['id'] || '';
            if (this.dossierId) {
                this.bootstrap();
            }
        });
    }

    ngOnDestroy(): void {
        this.routeSub?.unsubscribe();
        this.pollSub?.unsubscribe();
    }

    private bootstrap(): void {
        this.isLoading = true;
        this.projectsService.getDossier(this.dossierId).subscribe({
            next: (dossier) => {
                this.dossierTitle = dossier.intituleOffre || 'Dossier AO';
                this.dossierStatus = dossier.status;
                this.isConsultation = this.isAdvancedWorkflowStatus(this.dossierStatus);
                this.isFinalLocked = this.isManagerValidatedStatus(this.dossierStatus);
                if (this.dossierStatus === 'PARSING_INITIAL') {
                    this.startPollingStatus();
                } else {
                    this.loadExtractionMetadata();
                }
            },
            error: () => {
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Dossier introuvable.' });
                this.isLoading = false;
            }
        });
    }

    private startPollingStatus(): void {
        this.isWaitingForAI = true;
        this.pollSub?.unsubscribe();
        this.pollSub = this.statusService.watchUploadPipeline(this.dossierId, (resp) => {
            this.dossierStatus = resp.status;
        }).subscribe({
            next: (resp) => {
                if (resp.status === 'CORRECTION_LOOP' || resp.status === 'INDEXED') {
                    this.isWaitingForAI = false;
                    this.pollSub?.unsubscribe();
                    this.loadExtractionMetadata();
                    this.messageService.add({ severity: 'success', summary: 'Extraction terminée', detail: 'L\'IA a extrait les données.' });
                } else if (resp.status === 'ERROR') {
                    this.isWaitingForAI = false;
                    this.pollSub?.unsubscribe();
                    this.messageService.add({ severity: 'error', summary: 'Erreur IA', detail: 'L\'extraction a échoué.' });
                }
            }
        });
    }

    private loadExtractionMetadata(): void {
        this.projectsService.getExtractionP1(this.dossierId).subscribe({
            next: (metas: ExtractionMetadata[]) => {
                if (!metas || metas.length === 0) {
                    this.messageService.add({ severity: 'warn', summary: 'Aucune donnée', detail: 'L\'IA n\'a rien extrait ou la base est vide.' });
                    this.fields = [];
                } else {
                    this.mapMetadata(metas);
                }

                this.computeTjm();
                this.checkVisiteAlert();
                this.isLoading = false;
            },
            error: () => {
                this.isLoading = false;
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'GET /extraction-p1 indisponible.' });
            }
        });
    }



    groupedFields: any[] = [];
    apoPreviewDataResult: Record<string, string> = {};
    apoConfidencesResult: Record<string, number> = {};

    private updateGroupedFields() {
        const sectionA = ['INTITULE_OFFRE', 'CLIENT', 'PAYS', 'BAILLEURS'];
        const sectionB = ['DT_LIM_SOUM', 'VISITE_OBL', 'VISITE_DATE', 'CONF_OBL', 'CONF_DATE'];
        const sectionC = ['BUDGET_GLOBAL', 'HOMMES_MOIS', 'LANGUE'];

        const aFields = this.fields.filter(f => sectionA.includes(f.id));
        const bFields = this.fields.filter(f => sectionB.includes(f.id));
        const cFields = this.fields.filter(f => sectionC.includes(f.id));
        const otherFields = this.fields.filter(f => !sectionA.includes(f.id) && !sectionB.includes(f.id) && !sectionC.includes(f.id));

        const groups = [];
        if (aFields.length > 0) groups.push({ title: 'SECTION A — IDENTIFICATION', icon: 'pi-id-card', color: 'blue', fields: aFields });
        if (bFields.length > 0) groups.push({ title: 'SECTION B — CALENDRIER', icon: 'pi-calendar', color: 'orange', fields: bFields });
        if (cFields.length > 0) groups.push({ title: 'SECTION C — FINANCIER', icon: 'pi-dollar', color: 'green', fields: cFields });
        if (otherFields.length > 0) groups.push({ title: 'AUTRES CHAMPS (DYNAMIQUE)', icon: 'pi-sparkles', color: 'blue', fields: otherFields });

        this.groupedFields = groups;
        this.updateApoData();
    }

    private updateApoData() {
        const apoData: Record<string, string> = {};
        const apoConf: Record<string, number> = {};
        this.fields.forEach(f => {
            apoData[f.id] = f.value?.toString() ?? '';
            apoConf[f.id] = f.confidence / 100;
        });
        this.apoPreviewDataResult = apoData;
        this.apoConfidencesResult = apoConf;
    }

    private mapMetadata(metas: ExtractionMetadata[]): void {
        this.fields = metas.map(m => {
            const raw = (m.valeurFinale === null || m.valeurFinale === 'null') ? null : (m.valeurFinale ?? m.valeurClaude ?? null);
            let val: any = raw;
            let type: 'select' | 'date' | 'input' | 'number' | 'money' = 'input';
            let options: string[] = [];

            // Détection du type
            const normalizedId = m.fieldName.toUpperCase().replace(/\s+/g, '_');
            const lowerId = normalizedId.toLowerCase();

            if (lowerId.includes('date') || lowerId.includes('dt_')) {
                type = 'date';
            } else if (lowerId.includes('obl') || lowerId.includes('oui_non') || (raw && (String(raw).toLowerCase() === 'true' || String(raw).toLowerCase() === 'false'))) {
                type = 'select';
                options = ['Oui', 'Non'];
                if (raw !== null && raw !== '') {
                    val = (String(raw).toLowerCase() === 'true' || String(raw).toLowerCase() === 'oui') ? 'Oui' : 'Non';
                }
            } else if (lowerId === 'langue') {
                type = 'select';
                options = ['Français', 'Arabe', 'Anglais', 'Espagnol', 'Portugais'];
            } else if (lowerId === 'budget_global') {
                type = 'money';
            }

            let amount: number | undefined;
            let currency: string | undefined;

            if (type === 'money' && val) {
                const strVal = String(val);
                const numMatch = strVal.match(/[\d\s.,]+/);
                if (numMatch) {
                    amount = parseFloat(numMatch[0].replace(/\s/g, '').replace(',', '.'));
                }
                const currMatch = strVal.match(/[A-Za-z$€£]+/);
                if (currMatch) {
                    const extractedCurr = currMatch[0].toUpperCase();
                    currency = this.currencies.includes(extractedCurr) ? extractedCurr : 'Autre';
                }
            }

            return {
                id: normalizedId,
                label: m.fieldName.replace(/_/g, ' '),
                value: val || '',
                type: type,
                confidence: Math.round((m.confiance ?? 0) * 100),
                validated: this.isConsultation,
                editing: false,
                humanModified: !!m.humanModified,
                sourceText: m.sourceExtrait ?? m.source ?? '',
                options: options,
                amount: amount,
                currency: currency
            };
        });
        this.updateGroupedFields();
    }

    confidenceClass(c: number): string {
        if (c === 0) return 'conf-none';
        if (c >= 80) return 'conf-high';
        if (c >= 50) return 'conf-mid';
        return 'conf-low';
    }

    private isAdvancedWorkflowStatus(status: string): boolean {
        return ['DEEP_ANALYSIS', 'SCORING', 'MANUAL_INTERVENTION', 'FORCE_GO',
            'NO_GO_CONFIRMED', 'MATCHING', 'DRAFTING', 'REPORT_GENERATED',
            'PACK_READY', 'PENDING_VALIDATION', 'SUBMITTED', 'AUDIT', 'ARCHIVED'].includes(status);
    }

    private isManagerValidatedStatus(status: string): boolean {
        return ['SUBMITTED', 'AUDIT', 'ARCHIVED'].includes(status);
    }

    startRevalidation(): void {
        if (this.isFinalLocked) return;
        this.isConsultation = false;
        this.messageService.add({ severity: 'info', summary: 'Révalidation P1', detail: 'Les champs sont déverrouillés. Enregistrez pour conserver les corrections.' });
    }

    startEdit(f: P1Field): void {
        f.editing = true;
    }

    saveEdit(f: P1Field): void {
        f.editing = false;
        f.humanModified = true;
        if (f.type === 'money') {
            f.value = f.amount ? `${f.amount} ${f.currency || ''}`.trim() : '';
        }
        this.computeTjm();
        this.checkVisiteAlert();
        this.updateApoData();
    }

    reextract(f: P1Field): void {
        this.projectsService.reextractField(this.dossierId, f.id).subscribe({
            next: (res) => {
                if (f.options?.includes('Oui') && f.options?.includes('Non')) {
                    f.value = (res.valeur === true || res.valeur === 'true' || res.valeur === 'Oui') ? 'Oui' : 'Non';
                } else {
                    f.value = res.valeur;
                }
                f.confidence = Math.round((res.confiance ?? 0) * 100);
                f.humanModified = false;
                f.validated = false;
                this.computeTjm();
                this.updateApoData();
                this.messageService.add({ severity: 'success', summary: 'Ré-extraction', detail: `Champ ${f.label} mis à jour.` });
            },
            error: (err) => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Limite atteinte ?',
                    detail: err?.error?.message || 'PUT /reextract-field échoué (max 2×).'
                });
            }
        });
    }

    validateField(f: P1Field): void {
        f.validated = !f.validated;
        f.editing = false;
    }

    toggleValidateAll(): void {
        const willValidate = this.validatedCount !== this.fields.length;
        this.fields.forEach(f => {
            f.validated = willValidate;
            f.editing = false;
        });
    }

    get validatedCount(): number {
        return this.fields.filter(f => f.validated).length;
    }

    get allValidated(): boolean {
        return this.fields.every(f => f.validated);
    }

    submitValidation(): void {
        if (!this.allValidated) return;
        this.isSubmitting = true;

        const dto: ValidateP1RequestDto = { champs: {} };
        this.fields.forEach(f => {
            let valeur = f.value?.toString() ?? '';

            if (f.type === 'money') {
                valeur = f.amount ? `${f.amount} ${f.currency || ''}`.trim() : '';
            } else if (f.options?.includes('Oui') && f.options?.includes('Non')) {
                valeur = f.value === 'Oui' ? 'true' : 'false';
            }

            dto.champs[f.id] = { valeur, humanModified: f.humanModified };
        });

        this.projectsService.validateP1(this.dossierId, dto).subscribe({
            next: (dossier) => {
                this.isSubmitting = false;
                this.dossierStatus = dossier.status;
                this.isConsultation = true;
                this.messageService.add({
                    severity: 'success',
                    summary: 'Dossier indexé',
                    detail: 'Statut → INDEXED. Champs propagés dans l\'APO.'
                });
                if (dossier.status === 'INDEXED') {
                    this.router.navigate(['/dossiers', this.dossierId, 'validation-p2']);
                }
            },
            error: (err) => {
                this.isSubmitting = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Validation échouée',
                    detail: err?.error?.message || 'PUT /validate-p1 a échoué.'
                });
            }
        });
    }

    private computeTjm(): void {
        const budget = this.fields.find(f => f.id === 'BUDGET_GLOBAL');
        const hm = this.fields.find(f => f.id === 'HOMMES_MOIS');
        if (!budget?.value || !hm?.value) return;

        const b = parseFloat(String(budget.value).replace(/[^0-9.]/g, ''));
        const h = parseFloat(String(hm.value).replace(/[^0-9.]/g, ''));
        if (b > 0 && h > 0) {
            this.tjmImplicite = Math.round((b / h / 20) * 100) / 100;
            this.tjmAlert = this.tjmImplicite < 300 || this.tjmImplicite > 1500;
        }
    }

    private checkVisiteAlert(): void {
        const vis = this.fields.find(f => f.id === 'VISITE_OBL');
        const visDate = this.fields.find(f => f.id === 'VISITE_DATE');
        this.visiteAlert = vis?.value === 'Oui' && !!visDate?.value && this.joursRestants <= 8;
    }

    statusLabel(s: string): string {
        return this.statusService.statusLabel(s);
    }

    getField(id: string): P1Field | undefined {
        return this.fields.find(f => f.id === id);
    }

    // ── AI LOGS ─────────────────────────────────────────────────────────────
    openAiLogs(): void {
        this.displayAiLogsDialog = true;
        this.aiLogsLoading = true;
        this.aiLogsService.getLogsByDossierId(this.dossierId).subscribe({
            next: (logs) => {
                this.aiLogs = logs;
                let tTokens = 0, tCost = 0, tTime = 0;
                logs.forEach(l => {
                    tTokens += l.tokensConsumed || 0;
                    tCost += l.estimatedCost || 0;
                    tTime += l.responseTimeMs || 0;
                });
                this.aiLogsStats = { totalTokens: tTokens, totalCost: tCost, totalTime: tTime };
                this.aiLogsLoading = false;
            },
            error: () => {
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger les logs IA.' });
                this.aiLogsLoading = false;
            }
        });
    }

    // ── Getters pour ApoPreview ──
    get apoPreviewData(): Record<string, string> {
        return this.apoPreviewDataResult;
    }

    get apoConfidences(): Record<string, number> {
        return this.apoConfidencesResult;
    }

    get validatedFieldIds(): string[] {
        return this.fields.filter(f => f.validated).map(f => f.id);
    }

    toggleApoPreview(): void {
        this.showApoPreview = !this.showApoPreview;
    }
}
