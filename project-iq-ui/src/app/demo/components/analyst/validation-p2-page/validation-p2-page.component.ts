import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Subscription } from 'rxjs';
import { AnalystProjectsService } from '../../../service/analyst-projects.service';

export interface P2Field {
    id: string;
    label: string;
    value: any;
    type: 'select' | 'input' | 'number';
    confidence: number;
    validated: boolean;
    editing: boolean;
    humanModified: boolean;
    sourceText: string;
    options?: string[];
}

@Component({
    selector: 'app-validation-p2-page',
    templateUrl: './validation-p2-page.component.html',
    styleUrls: ['./validation-p2-page.component.scss'],
    providers: []
})
export class ValidationP2PageComponent implements OnInit, OnDestroy {

    dossierId = '';
    isLoading = true;
    isSubmitting = false;
    isConsultation = false;
    isFinalLocked = false;

    fields: P2Field[] = [];
    hasRedhibitoire = false;
    alertesIa: any = null;

    private routeSub?: Subscription;

    private readonly FIELD_DEFS: Omit<P2Field, 'value' | 'confidence' | 'validated' | 'editing' | 'humanModified' | 'sourceText'>[] = [
        { id: 'MODE_NOTATION', label: 'Mode de notation', type: 'select', options: ['Qualité seule', 'Q+Prix', 'Prix seul', 'Meilleure valeur'] },
        { id: 'PON_TECH', label: 'Pondération Technique', type: 'input' },
        { id: 'PON_FIN', label: 'Pondération Financière', type: 'input' },
        { id: 'NOTE_MINIMALE', label: 'Note minimale requise', type: 'input' },
        { id: 'CAUTION_MONTANT', label: 'Montant de la caution', type: 'input' },
        { id: 'CAUTION_MONNAIE', label: 'Monnaie de la caution', type: 'select', options: ['EUR', 'USD', 'GBP', 'XOF', 'MAD', 'DZD', 'TND', 'Autre'] },
        { id: 'CAUTION_DUREE', label: 'Durée de validité (mois)', type: 'number' },
        { id: 'BANQUE_LOCALE_EXIGEE', label: 'Banque locale exigée ?', type: 'select', options: ['Oui', 'Non'] },
        { id: 'DELAI_PREP_SUF', label: 'Délai prép. suffisant ?', type: 'select', options: ['Suffisant', 'Limite', 'Insuffisant'] },
        { id: 'CAPACITE_DELAI', label: 'Capacité à tenir le délai', type: 'select', options: ['Oui', 'Non'] },
        { id: 'RISQUE_PAYS_SECURITE', label: 'Risque Pays / Sécurité', type: 'select', options: ['Faible', 'Modéré', 'Élevé', 'Rédhibitoire'] },
        { id: 'RISQUES_FINANCIERS', label: 'Risques Financiers', type: 'select', options: ['Faible', 'Modéré', 'Élevé', 'Rédhibitoire'] },
        { id: 'PENALITES', label: 'Pénalités', type: 'select', options: ['Faible', 'Modéré', 'Élevé', 'Rédhibitoire'] },
        { id: 'EXIGENCES_TDR_INACCEPTABLES', label: 'Exigences TdR inacceptables', type: 'select', options: ['Faible', 'Modéré', 'Élevé', 'Rédhibitoire'] },
        { id: 'GARANTIES_ASSURANCES_ELEVEES', label: 'Garanties / Assurances élevées', type: 'select', options: ['Faible', 'Modéré', 'Élevé', 'Rédhibitoire'] },
        { id: 'TAILLE_DISPERSION', label: 'Taille & Dispersion', type: 'select', options: ['Faible', 'Modéré', 'Élevé', 'Rédhibitoire'] },
        { id: 'FRAIS_DIVERS_ELEVES', label: 'Frais divers élevés', type: 'select', options: ['Faible', 'Modéré', 'Élevé', 'Rédhibitoire'] },
        { id: 'BUDGET_FAIBLE_HM_LIMITES', label: 'Budget faible / HM limités', type: 'select', options: ['Faible', 'Modéré', 'Élevé', 'Rédhibitoire'] },
        { id: 'PARTICIPATION_LOCALE_EXCESSIVE', label: 'Participation locale excessive', type: 'select', options: ['Faible', 'Modéré', 'Élevé', 'Rédhibitoire'] },
        { id: 'FISCALITE_NON_MAITRISEE', label: 'Fiscalité non maîtrisée', type: 'select', options: ['Faible', 'Modéré', 'Élevé', 'Rédhibitoire'] }
    ];

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private projectsService: AnalystProjectsService,
        private messageService: MessageService
    ) {}

    ngOnInit(): void {
        this.routeSub = this.route.params.subscribe(params => {
            this.dossierId = params['id'] || '';
            if (this.dossierId) {
                // Garde : vérifier que P1 est validé avant d'autoriser l'accès à P2
                this.projectsService.getDossier(this.dossierId).subscribe({
                    next: (dossier) => {
                        this.isConsultation = this.isAdvancedWorkflowStatus(dossier.status);
                        this.isFinalLocked = ['SUBMITTED', 'AUDIT', 'ARCHIVED'].includes(dossier.status);
                        const allowedStatuses = ['INDEXED', 'DEEP_ANALYSIS', 'SCORING', 'MATCHING',
                            'MANUAL_INTERVENTION', 'FORCE_GO', 'NO_GO_CONFIRMED',
                            'DRAFTING', 'REPORT_GENERATED', 'PACK_READY',
                            'PENDING_VALIDATION', 'SUBMITTED', 'AUDIT', 'ARCHIVED'];
                        if (!allowedStatuses.includes(dossier.status)) {
                            this.messageService.add({
                                severity: 'warn',
                                summary: 'Phase 1 requise',
                                detail: 'Veuillez d\'abord valider la Phase 1 avant d\'accéder à la Phase 2.'
                            });
                            this.router.navigate(['/dossiers', this.dossierId, 'validation-p1']);
                            return;
                        }
                        this.loadExtractionP2();
                    },
                    error: () => this.loadExtractionP2()
                });
            }
        });
    }

    ngOnDestroy(): void {
        this.routeSub?.unsubscribe();
    }

    private loadExtractionP2(): void {
        this.isLoading = true;
        this.fields = this.FIELD_DEFS.map(def => ({
            ...def, value: '', confidence: 0, validated: false, editing: false, humanModified: false, sourceText: '', options: def.options ?? []
        }));

        this.projectsService.getExtractionP2(this.dossierId).subscribe({
            next: (data) => {
                if (data && Object.keys(data).length > 0) {
                    this.mapBackendData(data);
                } else {
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'Données vides',
                        detail: 'Aucun champ P2 retourné. Déclenchez d\'abord POST /api/analyses/{id}/deep-analysis.'
                    });
                }
                this.computeScores();
                if (this.isConsultation) {
                    this.fields.forEach(field => field.validated = true);
                }
                this.updateGroupedFields();
                this.updateApoData();
                this.isLoading = false;
            },
            error: (err) => {
                this.isLoading = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur chargement P2',
                    detail: err?.error?.message || 'GET /api/analyses/' + this.dossierId + '/extraction-p2 a échoué.'
                });
            }
        });
    }

    private mapBackendData(data: any): void {
        const mapping: Record<string, string> = {
            noteMinimale:               'NOTE_MINIMALE',
            ponTech:                    'PON_TECH',
            ponFin:                     'PON_FIN',
            cautionMontant:             'CAUTION_MONTANT',
            cautionMonnaie:             'CAUTION_MONNAIE',
            cautionDuree:               'CAUTION_DUREE',
            banqueLocaleExigee:         'BANQUE_LOCALE_EXIGEE',
            delaiPrepSuf:               'DELAI_PREP_SUF',
            capaciteDelai:              'CAPACITE_DELAI',
            risquePaysSecurite:         'RISQUE_PAYS_SECURITE',
            risquesFinanciers:          'RISQUES_FINANCIERS',
            penalites:                  'PENALITES',
            exigencesTdrInacceptables:  'EXIGENCES_TDR_INACCEPTABLES',
            garantiesAssurancesElevees: 'GARANTIES_ASSURANCES_ELEVEES',
            tailleDispersion:           'TAILLE_DISPERSION',
            fraisDiversEleves:          'FRAIS_DIVERS_ELEVES',
            budgetFaibleHmLimites:      'BUDGET_FAIBLE_HM_LIMITES',
            participationLocaleExcessive:'PARTICIPATION_LOCALE_EXCESSIVE',
            fiscaliteNonMaitrisee:      'FISCALITE_NON_MAITRISEE'
        };

        Object.entries(mapping).forEach(([backendKey, fieldId]) => {
            const f = this.fields.find(x => x.id === fieldId);
            if (!f) return;
            const raw = data[backendKey];
            if (raw == null) return;
            if (typeof raw === 'string' && raw.includes('||')) {
                f.value = raw.split('||')[0].trim();
                f.sourceText = raw.split('||')[1]?.trim() ?? '';
            } else {
                f.value = raw?.toString() ?? '';
            }
            f.confidence = 85;
        });
    }


    groupedFields: any[] = [];
    apoPreviewDataResult: Record<string, string> = {};
    apoConfidencesResult: Record<string, number> = {};
    validatedFieldIds: string[] = [];

    private updateGroupedFields() {
        const sectionD = ['MODE_NOTATION', 'PON_TECH', 'PON_FIN', 'NOTE_MINIMALE'];
        const sectionE = ['CAUTION_MONTANT', 'CAUTION_MONNAIE', 'CAUTION_DUREE', 'BANQUE_LOCALE_EXIGEE', 'DELAI_PREP_SUF', 'CAPACITE_DELAI'];
        const sectionF = [
            'RISQUE_PAYS_SECURITE', 'RISQUES_FINANCIERS', 'PENALITES', 'EXIGENCES_TDR_INACCEPTABLES', 
            'GARANTIES_ASSURANCES_ELEVEES', 'TAILLE_DISPERSION', 'FRAIS_DIVERS_ELEVES', 
            'BUDGET_FAIBLE_HM_LIMITES', 'PARTICIPATION_LOCALE_EXCESSIVE', 'FISCALITE_NON_MAITRISEE'
        ];

        this.groupedFields = [
            { title: 'SECTION D — NOTATION & SÉLECTION', icon: 'pi-star', color: 'blue', fields: this.fields.filter(f => sectionD.includes(f.id)) },
            { title: 'SECTION E — CAUTION & DÉLAI', icon: 'pi-shield', color: 'orange', fields: this.fields.filter(f => sectionE.includes(f.id)) },
            { title: 'SECTION F — 10 RISQUES (GÉNÉRÉS PAR IA)', icon: 'pi-exclamation-triangle', color: 'red', fields: this.fields.filter(f => sectionF.includes(f.id)) }
        ];
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
        this.validatedFieldIds = this.fields.filter(f => f.validated).map(f => f.id);
    }

    confidenceClass(c: number): string {
        if (c >= 80) return 'conf-high';
        if (c >= 50) return 'conf-mid';
        return 'conf-low';
    }

    private isAdvancedWorkflowStatus(status: string): boolean {
        return ['MATCHING', 'DRAFTING', 'REPORT_GENERATED', 'PACK_READY',
            'PENDING_VALIDATION', 'SUBMITTED', 'AUDIT', 'ARCHIVED'].includes(status);
    }

    startRevalidation(): void {
        if (this.isFinalLocked) return;
        this.isConsultation = false;
        this.messageService.add({ severity: 'info', summary: 'Révalidation P2', detail: 'Les champs sont déverrouillés. Enregistrez pour conserver les corrections.' });
    }

    startEdit(f: P2Field): void { f.editing = true; }

    saveEdit(f: P2Field): void {
        f.editing = false;
        f.humanModified = true;
        this.computeScores();
        this.updateApoData();
    }

    reextract(f: P2Field): void {
        this.projectsService.reextractField(this.dossierId, f.id).subscribe({
            next: (res) => {
                f.value = res.valeur ?? f.value;
                f.confidence = Math.round((res.confiance ?? 0) * 100);
                f.humanModified = false;
                f.validated = false;
                this.computeScores();
                this.updateApoData();
                this.messageService.add({ severity: 'success', summary: 'Ré-extraction', detail: `Champ ${f.label} mis à jour.` });
            },
            error: (err) => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Ré-extraction échouée',
                    detail: err?.error?.message || 'PUT /reextract-field a échoué (max 2×).'
                });
            }
        });
    }

    validateField(f: P2Field): void {
        f.validated = !f.validated;
        f.editing = false;
        this.updateApoData();
    }

    toggleValidateAll(): void {
        const willValidate = this.validatedCount !== this.fields.length;
        this.fields.forEach(f => { f.validated = willValidate; f.editing = false; });
        this.updateApoData();
    }

    get validatedCount(): number { return this.fields.filter(f => f.validated).length; }

    get allValidated(): boolean { return this.fields.every(f => f.validated); }

    /** Recalcul automatique à chaque modification de champ */
    onFieldChange(f: P2Field): void {
        this.computeScores();
        this.updateApoData();
    }

    private computeScores(): void {
        this.checkRedhibitoire();
    }

    private checkRedhibitoire(): void {
        const risks = this.fields.filter(f => f.id.startsWith('RISQUE') || f.id === 'PENALITES' || f.id === 'EXIGENCES_TDR_INACCEPTABLES' || f.id === 'GARANTIES_ASSURANCES_ELEVEES' || f.id === 'TAILLE_DISPERSION' || f.id === 'FRAIS_DIVERS_ELEVES' || f.id === 'BUDGET_FAIBLE_HM_LIMITES' || f.id === 'PARTICIPATION_LOCALE_EXCESSIVE' || f.id === 'FISCALITE_NON_MAITRISEE');
        this.hasRedhibitoire = risks.some(r => r.value === 'Rédhibitoire');
    }

    submitValidation(): void {
        if (!this.allValidated) return;
        this.isSubmitting = true;

        const capaciteDelai = this.fields.find(f => f.id === 'CAPACITE_DELAI')?.value?.toString() ?? '';

        const body: Record<string, any> = {
            noteMinimale:               this.fields.find(f => f.id === 'NOTE_MINIMALE')?.value ?? null,
            ponTech:                    parseFloat(this.fields.find(f => f.id === 'PON_TECH')?.value) || null,
            ponFin:                     parseFloat(this.fields.find(f => f.id === 'PON_FIN')?.value) || null,
            cautionMontant:             this.fields.find(f => f.id === 'CAUTION_MONTANT')?.value ?? null,
            cautionMonnaie:             this.fields.find(f => f.id === 'CAUTION_MONNAIE')?.value ?? null,
            cautionDuree:               this.fields.find(f => f.id === 'CAUTION_DUREE')?.value ?? null,
            banqueLocaleExigee:         this.fields.find(f => f.id === 'BANQUE_LOCALE_EXIGEE')?.value ?? null,
            delaiPrepSuf:               this.fields.find(f => f.id === 'DELAI_PREP_SUF')?.value ?? null,
            capaciteDelai:              capaciteDelai,
            justifCapaciteDelai:        capaciteDelai === 'Non'
                                            ? (this.fields.find(f => f.id === 'JUSTIF_CAPACITE_DELAI')?.value ?? '')
                                            : null,
            risquePaysSecurite:         this.buildRisque('RISQUE_PAYS_SECURITE'),
            risquesFinanciers:          this.buildRisque('RISQUES_FINANCIERS'),
            penalites:                  this.buildRisque('PENALITES'),
            exigencesTdrInacceptables:  this.buildRisque('EXIGENCES_TDR_INACCEPTABLES'),
            garantiesAssurancesElevees: this.buildRisque('GARANTIES_ASSURANCES_ELEVEES'),
            tailleDispersion:           this.buildRisque('TAILLE_DISPERSION'),
            fraisDiversEleves:          this.buildRisque('FRAIS_DIVERS_ELEVES'),
            budgetFaibleHmLimites:      this.buildRisque('BUDGET_FAIBLE_HM_LIMITES'),
            participationLocaleExcessive: this.buildRisque('PARTICIPATION_LOCALE_EXCESSIVE'),
            fiscaliteNonMaitrisee:      this.buildRisque('FISCALITE_NON_MAITRISEE')
        };

        this.projectsService.validateP2(this.dossierId, body).subscribe({
            next: () => {
                this.isSubmitting = false;
                this.isConsultation = true;
                this.messageService.add({
                    severity: 'success',
                    summary: 'Phase 2 validée',
                    detail: 'Données enregistrées. Calcul du P-Win en cours...'
                });
                this.router.navigate(['/dossiers', this.dossierId, 'scoring']);
            },
            error: (err) => {
                this.isSubmitting = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur validation P2',
                    detail: err?.error?.message || 'PUT /api/analyses/' + this.dossierId + '/validate-p2 a échoué.'
                });
            }
        });
    }

    private buildRisque(id: string): string {
        const f = this.fields.find(x => x.id === id);
        if (!f) return '';
        const niveau = f.value?.toString() ?? 'Faible';
        const justif = f.sourceText?.trim() ?? '';
        return justif ? `${niveau}||${justif}` : niveau;
    }

    isGeneratingNoGo = false;
    generatedNoGoPath: string | null = null;

    generateNoGoReport(): void {
        this.isGeneratingNoGo = true;
        this.projectsService.exportNoGoReport(this.dossierId).subscribe({
            next: (path) => {
                this.isGeneratingNoGo = false;
                this.generatedNoGoPath = path;
                this.messageService.add({
                    severity: 'success',
                    summary: 'Rapport No-Go Généré',
                    detail: 'Le rapport No-Go a été généré avec succès.'
                });
            },
            error: () => {
                this.isGeneratingNoGo = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur',
                    detail: 'La génération a échoué. Vérifiez le backend.'
                });
            }
        });
    }

    downloadNoGoReport(): void {
        if (this.generatedNoGoPath) {
            const url = `/api/export/download?path=${encodeURIComponent(this.generatedNoGoPath)}`;
            window.open(url, '_blank');
        }
    }

    get apoPreviewData(): Record<string, string> {
        return this.apoPreviewDataResult;
    }

    get apoConfidences(): Record<string, number> {
        return this.apoConfidencesResult;
    }
}
