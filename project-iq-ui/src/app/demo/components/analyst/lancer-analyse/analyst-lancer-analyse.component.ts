import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { HttpEventType } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';
import {
    AnalystProjectsService,
    ExtractionMetadata,
    ValidateP1RequestDto
} from '../../../../demo/service/analyst-projects.service';
import { SseService, PipelineEvent } from '../../../../services/sse.service';

export interface Field {
    id: string; // PropriÃ©tÃ© dans la classe Project du backend
    label: string;
    value: any;
    originalValue: any;
    type: 'select' | 'date' | 'input' | 'number';
    confidence: number; // 0 Ã  100
    status: 'ia' | 'human'; // 'ia' | 'human'
    validated: boolean;
    sourceText: string; // Texte de source pour surlignage PDF
    options?: string[]; // Pour les types select
    editing?: boolean;
    original_value?: any; // Pour l'historique de rÃ©-extraction
}

export interface AuditLogEntry {
    date: Date;
    author: string;
    action: string;
    details: string;
}

@Component({
    templateUrl: './analyst-lancer-analyse.component.html',
    styleUrls: ['./analyst-lancer-analyse.component.scss'],
    providers: [MessageService]
})
export class AnalystLancerAnalyseComponent implements OnInit, OnDestroy {

    // 6-Step workflow navigation
    activeIndex = 0; // 0: DÃ©pÃ´t, 1: Extraction, 2: Validation, 3: APO, 4: PrioritÃ©, 5: IndexÃ©
    private routeSub!: Subscription;
    private pollingSub?: Subscription;
    private sseSub?: Subscription;

    // Files DÃ©pÃ´t
    fileAP: File | null = null;
    fileTDR: File | null = null;
    dragOverAP = false;
    dragOverTDR = false;
    projectTitle = '';
    dateLimiteSaisie = ''; // ISO YYYY-MM-DD â€” envoyÃ© au backend avec le TDR

    projectId: string | null = null;
    projectBackendData: any = null;
    /** DerniÃ¨re rÃ©ponse brute du polling status */
    currentStatus = '';

    // Extraction processing vertical stepper (7 steps)
    verticalSteps = [
        { title: 'Chargement des documents (AP & TDR)', desc: 'Lecture brute des flux binaires et validation du format PDF.' },
        { title: 'OCR & Extraction textuelle', desc: 'Extraction des caractÃ¨res par calque et OCR intelligent.' },
        { title: 'DÃ©coupage sÃ©mantique', desc: 'Analyse de structure : Identification de l\'Avis et des TDR.' },
        { title: 'Parsing des entitÃ©s clÃ©s (IA)', desc: 'Extraction sÃ©mantique par Claude IA (Pays, Client, Dates).' },
        { title: 'Analyse financiÃ¨re & Enjeux', desc: 'Extraction du budget, hommes-mois et modalitÃ©s de paiement.' },
        { title: 'Ã‰valuation des contraintes', desc: 'Identification des visites obligatoires et des dates critiques.' },
        { title: 'Consolidation finale des 12 champs', desc: 'PrÃ©paration de la grille de validation.' }
    ];
    verticalStepStates: ('waiting' | 'running' | 'completed')[] = ['waiting', 'waiting', 'waiting', 'waiting', 'waiting', 'waiting', 'waiting'];
    isExtracting = false;
    isUploading = false;
    uploadProgress = 0;

    // Grille de Validation (12 champs)
    fields: Field[] = [];
    selectedFieldId = 'pays'; // Pour surlignage PDF
    referentielCache: { [key: string]: string[] } = {};

    // Modale ajout dynamique
    showAddValueModal = false;
    modalFieldType = ''; // PAYS, CLIENT, BAILLEURS, LANGUE
    newValueInput = '';

    // Business Logic & Alerts
    alerts: string[] = [];
    isSubmittingValidation = false;

    // APO Step
    apoProgress = 12; // DÃ©marre Ã  12/68
    isApoPulsing = false;

    // PrioritÃ© Step
    autoPriority = 3;
    manualPriority = 3;
    priorityOverride = false;
    auditLog: AuditLogEntry[] = [];

    // PDF Source highlights â€” keys = backend fieldName (PAYS, CLIENT, etc.)
    pdfHighlights: { [key: string]: { page: number; text: string; before: string; match: string; after: string } } = {
        PAYS:           { page: 1, text: 'Pays du projet',        before: 'implantÃ© en RÃ©publique du ', match: 'SÃ©nÃ©gal', after: ' conformÃ©ment aux directives.' },
        CLIENT:         { page: 1, text: 'Organisme Client',      before: 'sous l\'autoritÃ© exclusive de la ', match: 'SONATEL', after: ' Direction des RÃ©seaux.' },
        BAILLEURS:      { page: 2, text: 'Bailleurs de fonds',    before: 'prÃªt de l\'', match: 'AFD', after: ' cadre du plan d\'aide.' },
        LANGUE:         { page: 1, text: 'Langue officielle',     before: 'doit Ãªtre rÃ©digÃ©e en ', match: 'FranÃ§ais', after: ' ou traduction certifiÃ©e.' },
        VISITE_OBL:     { page: 3, text: 'Visite de site',        before: 'Les candidats doivent effectuer une ', match: 'visite de site obligatoire', after: ' le 12 octobre 2026.' },
        VISITE_DATE:    { page: 3, text: 'Date visite',           before: 'visite de site obligatoire le ', match: '12/10/2026', after: ' sous peine de rejet.' },
        CONF_OBL:       { page: 3, text: 'ConfÃ©rence prÃ©alable',  before: 'Il n\'est pas prÃ©vu de ', match: 'confÃ©rence prÃ©alable obligatoire', after: ' pour cette phase.' },
        CONF_DATE:      { page: 3, text: 'Date confÃ©rence',       before: 'ConfÃ©rence prÃ©vue le ', match: 'N/A', after: '.' },
        INTITULE_OFFRE: { page: 1, text: 'IntitulÃ©',              before: 'Objet de l\'appel d\'offres : ', match: 'Modernisation des Infrastructures RÃ©seaux', after: ' et transition Cloud.' },
        DT_LIM_SOUM:    { page: 1, text: 'Date limite soumission', before: 'Date limite de rÃ©ception : ', match: '15/11/2026', after: ' Ã  17h00 heure locale.' },
        BUDGET_GLOBAL:  { page: 5, text: 'Budget global',         before: 'enveloppe budgÃ©taire estimÃ©e Ã  ', match: '125 000 EUR', after: ' hors taxes.' },
        HOMMES_MOIS:    { page: 5, text: 'Effort hommes-mois',    before: 'effort attendu Ã©valuÃ© Ã  ', match: '14.5 hommes-mois', after: ' pour l\'ensemble des profils.' }
    };

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private projectsService: AnalystProjectsService,
        private messageService: MessageService,
        private sseService: SseService
    ) {}

    ngOnInit(): void {
        this.initializeFields();
        this.loadReferentiels();

        this.routeSub = this.route.queryParams.subscribe(params => {
            const step = parseInt(params['step'] || '0', 10);
            if (step >= 0 && step <= 5) {
                this.activeIndex = step;
            }
        });
    }

    ngOnDestroy(): void {
        this.routeSub?.unsubscribe();
        this.pollingSub?.unsubscribe();
        this.sseSub?.unsubscribe();
        if (this.projectId) {
            this.sseService.disconnect(this.projectId);
        }
    }

    // Initialiser les 12 champs bloquants Phase 1 â€” ids = noms enum backend (ExtractionMetadata.fieldName)
    private initializeFields(): void {
        this.fields = [
            { id: 'PAYS',           label: 'Pays',                   value: '', originalValue: '', type: 'select', confidence: 0, status: 'ia', validated: false, sourceText: '', options: [] },
            { id: 'CLIENT',         label: 'Client',                 value: '', originalValue: '', type: 'select', confidence: 0, status: 'ia', validated: false, sourceText: '', options: [] },
            { id: 'BAILLEURS',      label: 'Bailleurs de fonds',     value: '', originalValue: '', type: 'select', confidence: 0, status: 'ia', validated: false, sourceText: '', options: [] },
            { id: 'LANGUE',         label: 'Langue de soumission',   value: '', originalValue: '', type: 'select', confidence: 0, status: 'ia', validated: false, sourceText: '', options: [] },
            { id: 'VISITE_OBL',     label: 'Visite Obligatoire',     value: 'Non', originalValue: 'Non', type: 'select', confidence: 0, status: 'ia', validated: false, sourceText: '', options: ['Oui', 'Non'] },
            { id: 'VISITE_DATE',    label: 'Date visite de site',    value: '', originalValue: '', type: 'date', confidence: 0, status: 'ia', validated: false, sourceText: '' },
            { id: 'CONF_OBL',       label: 'ConfÃ©rence Obligatoire', value: 'Non', originalValue: 'Non', type: 'select', confidence: 0, status: 'ia', validated: false, sourceText: '', options: ['Oui', 'Non'] },
            { id: 'CONF_DATE',      label: 'Date confÃ©rence prÃ©alable', value: '', originalValue: '', type: 'date', confidence: 0, status: 'ia', validated: false, sourceText: '' },
            { id: 'INTITULE_OFFRE', label: 'IntitulÃ© de l\'offre',  value: '', originalValue: '', type: 'input', confidence: 0, status: 'ia', validated: false, sourceText: '' },
            { id: 'DT_LIM_SOUM',   label: 'Date limite soumission', value: '', originalValue: '', type: 'date',  confidence: 0, status: 'ia', validated: false, sourceText: '' },
            { id: 'BUDGET_GLOBAL',  label: 'Budget global',          value: '', originalValue: '', type: 'input', confidence: 0, status: 'ia', validated: false, sourceText: '' },
            { id: 'HOMMES_MOIS',    label: 'Charge (Hommes-Mois)',   value: 0,  originalValue: 0,  type: 'number', confidence: 0, status: 'ia', validated: false, sourceText: '' }
        ];
    }

    // Map rÃ©fÃ©rentiel type â†’ field id (les ids correspondent maintenant aux noms enum backend)
    private readonly REFERENTIEL_FIELD_MAP: { [type: string]: string } = {
        PAYS: 'PAYS', CLIENT: 'CLIENT', BAILLEUR: 'BAILLEURS', LANGUE: 'LANGUE'
    };

    // Charger les listes de rÃ©fÃ©rentiel depuis le backend Spring Boot (ReferentielController)
    private loadReferentiels(): void {
        const types = ['PAYS', 'CLIENT', 'BAILLEUR', 'LANGUE'];

        types.forEach(type => {
            this.projectsService.getReferentiel(type).subscribe({
                next: (values) => {
                    this.referentielCache[type] = values;
                    const fieldId = this.REFERENTIEL_FIELD_MAP[type];
                    const field = this.fields.find(f => f.id === fieldId);
                    if (field) field.options = [...values, 'Autre (Saisie libre)'];
                },
                error: () => {
                    let fallbacks: string[] = [];
                    if (type === 'PAYS')    fallbacks = ['Maroc', 'Tunisie', 'SÃ©nÃ©gal', 'CÃ´te d\'Ivoire', 'France'];
                    else if (type === 'CLIENT')  fallbacks = ['SONATEL', 'Orange', 'MinistÃ¨re de l\'Ã‰ducation', 'UNDP', 'Banque Mondiale'];
                    else if (type === 'BAILLEUR') fallbacks = ['AFD', 'Banque Mondiale', 'UE', 'BAD', 'USAID'];
                    else if (type === 'LANGUE')  fallbacks = ['FranÃ§ais', 'Anglais', 'Arabe'];
                    this.referentielCache[type] = fallbacks;
                    const fieldId = this.REFERENTIEL_FIELD_MAP[type];
                    const field = this.fields.find(f => f.id === fieldId);
                    if (field) field.options = [...fallbacks, 'Autre (Saisie libre)'];
                }
            });
        });
    }

    // Navigation de l'application
    navigateToStep(step: number): void {
        // Bloquer la navigation manuelle vers des Ã©tapes futures si non validÃ©
        if (step > this.activeIndex && this.activeIndex === 0 && !this.projectId) {
            this.messageService.add({ severity: 'warn', summary: 'DÃ©pÃ´t requis', detail: 'Veuillez d\'abord dÃ©poser les documents.' });
            return;
        }
        if (step > this.activeIndex && this.activeIndex === 2 && !this.isAllFieldsValidated()) {
            this.messageService.add({ severity: 'warn', summary: 'Validation requise', detail: 'Veuillez valider les 12 champs clÃ©s.' });
            return;
        }

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { step },
            queryParamsHandling: 'merge'
        });
    }

    // â”€â”€ STEP 0: DÃ©pÃ´t â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    onDragOver(event: DragEvent, type: 'AP' | 'TDR'): void {
        event.preventDefault();
        if (type === 'AP') this.dragOverAP = true;
        else this.dragOverTDR = true;
    }

    onDragLeave(event: DragEvent, type: 'AP' | 'TDR'): void {
        event.preventDefault();
        if (type === 'AP') this.dragOverAP = false;
        else this.dragOverTDR = false;
    }

    onDrop(event: DragEvent, type: 'AP' | 'TDR'): void {
        event.preventDefault();
        if (type === 'AP') this.dragOverAP = false;
        else this.dragOverTDR = false;
        
        const file = event.dataTransfer?.files?.[0];
        if (file) this.setFile(file, type);
    }

    onFileSelect(event: Event, type: 'AP' | 'TDR'): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (file) this.setFile(file, type);
        input.value = '';
    }

    private setFile(file: File, type: 'AP' | 'TDR'): void {
        if (!/\.pdf$/i.test(file.name)) {
            this.messageService.add({
                severity: 'error',
                summary: 'Format invalide',
                detail: `Le fichier ${file.name} doit Ãªtre au format PDF.`
            });
            return;
        }
        
        if (type === 'AP') {
            this.fileAP = file;
        } else {
            this.fileTDR = file;
            // PrÃ©-remplir le titre avec le nom du fichier TDR sans extension
            if (!this.projectTitle) {
                this.projectTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
            }
        }
        
        this.messageService.add({
            severity: 'success',
            summary: 'Fichier chargÃ©',
            detail: `${type === 'AP' ? 'L\'Avis de PublicitÃ©' : 'Les Termes de RÃ©fÃ©rence'} ont Ã©tÃ© validÃ©s.`
        });
    }

    clearFile(type: 'AP' | 'TDR'): void {
        if (type === 'AP') this.fileAP = null;
        else this.fileTDR = null;
    }

    formatFileSize(bytes: number): string {
        if (!bytes) return '';
        const k = 1024;
        const units = ['octets', 'Ko', 'Mo'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
    }

    // Lancement de l'upload et de la phase d'extraction
    launchUploadAndAnalysis(): void {
        if (!this.fileTDR) {
            this.messageService.add({ severity: 'warn', summary: 'TDR manquant', detail: 'Veuillez déposer les Termes de Référence (TDR) au format PDF.' });
            return;
        }
        if (!this.dateLimiteSaisie) {
            this.messageService.add({ severity: 'warn', summary: 'Date limite requise', detail: 'Veuillez saisir la date limite de soumission.' });
            return;
        }

        this.isUploading = true;
        this.uploadProgress = 15;
        this.verticalStepStates = ['waiting', 'waiting', 'waiting', 'waiting', 'waiting', 'waiting', 'waiting'];

        // POST /api/dossiers/upload - avec suivi de la progression
        this.projectsService.uploadDossier(this.fileTDR, this.dateLimiteSaisie).subscribe({
            next: (event: any) => {
                if (event.type === HttpEventType.UploadProgress) {
                    if (event.total) {
                        this.uploadProgress = Math.round(100 * event.loaded / event.total);
                    }
                } else if (event.type === HttpEventType.Response) {
                    const dossier = event.body;
                    this.uploadProgress = 100;
                    this.isUploading = false;
                    this.projectId = dossier.id;
                    this.projectBackendData = dossier;
                    localStorage.setItem('lastProjectId', dossier.id);
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Upload reussi',
                        detail: "Le dossier a ete televerse avec succes. Passage automatique a l'extraction."
                    });
                    this.isExtracting = true;
                    this.navigateToStep(1);
                    this.verticalStepStates = ['running', 'waiting', 'waiting', 'waiting', 'waiting', 'waiting', 'waiting'];
                    this.animateVerticalStepsWhilePolling();
                }
            },
            error: (err) => {
                this.isUploading = false;
                this.uploadProgress = 0;
                this.isExtracting = false;
                this.messageService.add({ severity: 'error', summary: 'Erreur d\'upload', detail: 'Le téléchargement a échoué.' });
            }
        });
    }

    // â”€â”€ STEP 1: Extraction â€” Polling du statut backend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    /** Anime visuellement le stepper pendant le vrai polling du statut backend */
    private animateVerticalStepsWhilePolling(): void {
        let visualStep = 0;

        // Avancer un step visuel toutes les 4 secondes (indÃ©pendant du polling)
        const visualTimer = setInterval(() => {
            if (visualStep < this.verticalSteps.length - 1) {
                this.verticalStepStates[visualStep] = 'completed';
                visualStep++;
                this.verticalStepStates[visualStep] = 'running';
            }
        }, 4000);

        // Polling rÃ©el : GET /api/dossiers/{id}/status toutes les 4s
        this.pollingSub = interval(4000).pipe(
            switchMap(() => this.projectsService.pollStatus(this.projectId!)),
            takeWhile((resp) => {
                this.currentStatus = resp.status;
                return resp.status !== 'CORRECTION_LOOP'
                    && resp.status !== 'INDEXED'
                    && resp.status !== 'NO_GO_CONFIRMED'
                    && resp.status !== 'MANUAL_INTERVENTION'
                    && resp.status !== 'ERROR';
            }, true) // inclusive: last emit when condition becomes false
        ).subscribe({
            next: (resp) => {
                if (resp.status === 'CORRECTION_LOOP' || resp.status === 'INDEXED') {
                    clearInterval(visualTimer);
                    // Marquer tous les steps visuels comme complÃ©tÃ©s
                    this.verticalStepStates = this.verticalStepStates.map(() => 'completed');
                    this.isExtracting = false;
                    this.loadExtractionP1FromBackend();
                } else if (resp.status === 'NO_GO_CONFIRMED' || resp.status === 'MANUAL_INTERVENTION' || resp.status === 'ERROR') {
                    clearInterval(visualTimer);
                    this.isExtracting = false;
                    this.messageService.add({ severity: 'error', summary: 'Extraction Ã©chouÃ©e', detail: `Statut : ${resp.status}. Intervention manuelle requise.` });
                    this.navigateToStep(0);
                }
            },
            error: () => {
                clearInterval(visualTimer);
                this.isExtracting = false;
                this.messageService.add({ severity: 'warn', summary: 'Connexion backend', detail: 'Impossible de joindre le serveur. RÃ©essayez.' });
                this.navigateToStep(0);
            }
        });
    }

    // Charge les ExtractionMetadata[] et peuple la grille de validation
    private loadExtractionP1FromBackend(): void {
        if (!this.projectId) return;

        this.projectsService.getExtractionP1(this.projectId).subscribe({
            next: (metadatas: ExtractionMetadata[]) => {
                this.mapExtractionMetadataToFields(metadatas);
                this.computeContextAlerts();
                this.navigateToStep(2);
                this.messageService.add({ severity: 'success', summary: 'Extraction consolidÃ©e', detail: 'Les donnÃ©es extraites par Claude IA sont prÃªtes pour validation.' });
            },
            error: () => {
                this.messageService.add({ severity: 'error', summary: 'Erreur de chargement', detail: 'Impossible de rÃ©cupÃ©rer les champs de validation.' });
            }
        });
    }

    /** Mappe ExtractionMetadata[] (backend) â†’ fields[] (frontend).
     *  fieldName correspond exactement Ã  Field.id (PAYS, CLIENT, etc.) */
    private mapExtractionMetadataToFields(metadatas: ExtractionMetadata[]): void {
        const metaMap = new Map<string, ExtractionMetadata>();
        metadatas.forEach(m => metaMap.set(m.fieldName, m));

        this.fields.forEach(f => {
            const meta = metaMap.get(f.id);
            if (!meta) return;

            const rawVal = meta.valeurFinale ?? meta.valeurClaude ?? '';

            // VISITE_OBL / CONF_OBL : le backend renvoie 'true'/'false' comme string
            if (f.id === 'VISITE_OBL' || f.id === 'CONF_OBL') {
                f.value = (String(rawVal).toLowerCase() === 'true') ? 'Oui' : 'Non';
            } else {
                f.value = rawVal;
            }

            f.originalValue = f.value;
            f.confidence    = Math.round((meta.confiance ?? 0) * 100); // 0.0â€“1.0 â†’ 0â€“100
            f.sourceText    = meta.sourceExtrait ?? meta.source ?? '';
            f.status        = meta.humanModified ? 'human' : 'ia';
            f.validated     = false;
        });
    }

    // â”€â”€ STEP 2: Grille de Validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    selectField(fieldId: string): void {
        this.selectedFieldId = fieldId;
    }

    isAllFieldsValidated(): boolean {
        return this.fields.every(f => f.validated);
    }

    getValidatedCount(): number {
        return this.fields.filter(f => f.validated).length;
    }

    // DÃ©marrer l'Ã©dition en ligne
    startEditingField(field: Field): void {
        field.editing = true;
        this.selectField(field.id);
    }

    // Confirmer la modification
    saveEditedField(field: Field): void {
        field.editing = false;
        
        if (field.value !== field.originalValue) {
            field.status = 'human'; // Devient âœï¸
        }
        
        // Si l'utilisateur choisit d'ajouter une valeur dynamique dans un select
        if (field.type === 'select' && field.value === 'Autre (Saisie libre)') {
            this.openAddValueModal(field.id);
            // Remettre temporairement la valeur prÃ©cÃ©dente pour Ã©viter l'affichage de l'option brute
            field.value = field.originalValue;
            return;
        }

        this.computeContextAlerts();
    }

    // Valider un champ directement (coche verte)
    validateField(field: Field, event?: Event): void {
        if (event) event.stopPropagation();
        
        field.validated = true;
        field.editing = false;
        
        this.messageService.add({
            severity: 'success',
            summary: 'Champ validÃ©',
            detail: `Le champ ${field.label} a Ã©tÃ© sÃ©curisÃ©.`
        });

        // Si 12/12 sont validÃ©s, toast informatif
        if (this.isAllFieldsValidated()) {
            this.isApoPulsing = true;
            this.messageService.add({
                severity: 'info',
                summary: 'PrÃªt pour APO',
                detail: 'Les 12 champs sont validÃ©s ! Vous pouvez gÃ©nÃ©rer le template APO.',
                life: 5000
            });
        }
    }

    // Toggle validation en masse ("Tout valider" / "Tout annuler")
    toggleValidateAllFields(): void {
        const allValidated = this.isAllFieldsValidated();

        if (!allValidated) {
            // Valider tout
            this.fields.forEach(f => {
                f.validated = true;
                f.editing = false;
            });

            this.messageService.add({
                severity: 'success',
                summary: 'Validation complÃ¨te',
                detail: 'Les 12 champs sont validÃ©s.'
            });

            this.isApoPulsing = true;
            return;
        }

        // DÃ©valider tout (repartir de 0)
        this.fields.forEach(f => {
            f.validated = false;
            f.editing = false;
            f.status = 'ia';
        });

        this.isApoPulsing = false;

        this.messageService.add({
            severity: 'warn',
            summary: 'Validation rÃ©initialisÃ©e',
            detail: 'Tous les champs ont Ã©tÃ© remis Ã  lâ€™Ã©tat non validÃ©.'
        });
    }

    // RÃ©-extraction intelligente d'un champ par l'IA (Claude) â€” PUT /api/dossiers/{id}/reextract-field
    reExtractField(field: Field, event: Event): void {
        event.stopPropagation();
        if (!this.projectId) return;

        this.messageService.add({ severity: 'info', summary: 'Extraction IA', detail: `Claude IA rÃ©analyse le document pour le champ ${field.label}...` });

        this.projectsService.reextractField(this.projectId, field.id).subscribe({
            next: (result) => {
                field.original_value = field.value;
                const rawVal = result.valeur;
                if (field.id === 'VISITE_OBL' || field.id === 'CONF_OBL') {
                    field.value = (rawVal === true || rawVal === 'true') ? 'Oui' : 'Non';
                } else {
                    field.value = rawVal;
                }
                field.confidence = Math.round((result.confiance ?? 0) * 100);
                field.sourceText = result.source ?? field.sourceText;
                field.status = 'ia';
                field.validated = false;
                this.messageService.add({ severity: 'success', summary: 'Mis Ã  jour', detail: `Nouvelle valeur proposÃ©e pour ${field.label}.` });
                this.computeContextAlerts();
            },
            error: () => {
                this.messageService.add({ severity: 'error', summary: 'Erreur IA', detail: `Impossible de rÃ©-extraire le champ ${field.label}.` });
            }
        });
    }


    // Gestion du rÃ©fÃ©rentiel dynamique (Modale "Autre (Saisie libre)")
    openAddValueModal(fieldId: string): void {
        // fieldId = 'BAILLEURS' â†’ type rÃ©fÃ©rentiel = 'BAILLEUR'
        this.modalFieldType = fieldId === 'BAILLEURS' ? 'BAILLEUR' : fieldId;
        this.newValueInput = '';
        this.showAddValueModal = true;
    }

    closeAddValueModal(): void {
        this.showAddValueModal = false;
    }

    submitNewReferentielValue(): void {
        if (!this.newValueInput.trim()) return;

        const val = this.newValueInput.trim();
        
        // POST /api/referentiel/{type}
        this.projectsService.ajouterReferentiel(this.modalFieldType, val).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'RÃ©fÃ©rentiel enrichi',
                    detail: `"${val}" a Ã©tÃ© ajoutÃ© Ã  la liste ${this.modalFieldType}.`
                });

                // Mettre Ã  jour le cache local
                this.loadReferentiels();
                
                // Assigner la nouvelle valeur au champ correspondant
                const key = this.modalFieldType === 'BAILLEUR' ? 'BAILLEURS' : this.modalFieldType;
                const field = this.fields.find(f => f.id === key);
                if (field) {
                    field.value = val;
                    field.status = 'human'; // ModifiÃ© par l'homme
                }

                this.closeAddValueModal();
            },
            error: () => {
                // Fallback local si l'API Ã©choue
                const key = this.modalFieldType === 'BAILLEUR' ? 'BAILLEURS' : this.modalFieldType;
                const field = this.fields.find(f => f.id === key);
                if (field && field.options) {
                    // InsÃ©rer avant "Autre"
                    field.options.splice(field.options.length - 1, 0, val);
                    field.value = val;
                    field.status = 'human';
                }
                this.closeAddValueModal();
            }
        });
    }

    // Calcul des alertes contextuelles automatisÃ©es
    computeContextAlerts(): void {
        this.alerts = [];

        const budgetF = this.fields.find(f => f.id === 'BUDGET_GLOBAL');
        const hmM    = this.fields.find(f => f.id === 'HOMMES_MOIS');
        const dtLim  = this.fields.find(f => f.id === 'DT_LIM_SOUM');
        const visObl = this.fields.find(f => f.id === 'VISITE_OBL');

        // 1. Calcul de TJM indicatif et incohÃ©rences de budget
        if (budgetF && hmM) {
            const numBudget = parseFloat(budgetF.value.toString().replace(/[^0-9.]/g, ''));
            const numHM = parseFloat(hmM.value.toString());
            
            if (numBudget > 0 && numHM > 0) {
                const tjm = (numBudget / numHM) / 20; // 20 jours ouvrÃ©s par mois
                if (tjm < 300) {
                    this.alerts.push(`Attention : Le TJM indicatif de ce marchÃ© (${tjm.toFixed(0)}â‚¬) est trÃ¨s faible pour le profil d'experts requis.`);
                }
            }
            if (numHM > 50) {
                this.alerts.push('Volume critique : L\'effort requis dÃ©passe 50 hommes-mois, mobilisez un architecte senior.');
            }
        }

        // 2. Alerte de dÃ©lai de soumission critique (Ex. < 15 jours)
        if (dtLim && dtLim.value) {
            const dateSoum = new Date(dtLim.value);
            const today = new Date();
            const diffDays = Math.ceil((dateSoum.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diffDays < 15) {
                this.alerts.push(`DÃ©lai critique : Plus que ${diffDays} jours restants pour soumettre l'offre.`);
            }
        }

        // 3. Rappels de contrainte logistique
        if (visObl && visObl.value === 'Oui') {
            this.alerts.push('Planification : N\'oubliez pas de rÃ©server la visite de site obligatoire et d\'enregistrer le compte rendu.');
        }
    }

    // Soumission finale de l'Ã©tape de validation â€” PUT /api/dossiers/{id}/validate-p1
    submitValidation(): void {
        if (!this.projectId || !this.isAllFieldsValidated()) return;

        this.isSubmittingValidation = true;

        // Construire ValidateP1RequestDto { champs: { PAYS: {valeur, humanModified}, ... } }
        const dto: ValidateP1RequestDto = { champs: {} };

        this.fields.forEach(f => {
            let valeur: string;
            // VISITE_OBL et CONF_OBL : renvoyer comme boolÃ©en stringifiÃ© (backend le parse)
            if (f.id === 'VISITE_OBL' || f.id === 'CONF_OBL') {
                valeur = f.value === 'Oui' ? 'true' : 'false';
            } else {
                valeur = f.value?.toString() ?? '';
            }
            dto.champs[f.id] = { valeur, humanModified: f.status === 'human' };
        });

        // Appel PUT /api/dossiers/{id}/validate-p1
        this.projectsService.validateP1(this.projectId, dto).subscribe({
            next: (dossier) => {
                this.projectBackendData = dossier;
                this.isSubmittingValidation = false;
                this.autoPriority  = dossier.priorite ?? 3;
                this.manualPriority = dossier.priorite ?? 3;
                this.priorityOverride = dossier.priorityOverride ?? false;
                this.auditLog = [{
                    date: new Date(),
                    author: 'SystÃ¨me ProjectIQ',
                    action: 'Attribution prioritÃ©',
                    details: `PrioritÃ© automatique calculÃ©e Ã  : P${dossier.priorite}`
                }];
                this.navigateToStep(3);
                this.startListeningToPipeline();
            },
            error: (err) => {
                this.isSubmittingValidation = false;
                this.messageService.add({ severity: 'error', summary: 'Erreur de validation', detail: err?.error?.message || 'Impossible de valider le dossier.' });
            }
        });
    }


    // â”€â”€ STEP 3: GÃ©nÃ©ration APO Remplissage Live â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    startListeningToPipeline(): void {
        if (!this.projectId) return;

        this.sseService.connect(this.projectId);
        
        this.sseSub = this.sseService.getEventSubject().subscribe((event: PipelineEvent) => {
            switch (event.type) {
                case 'PIPELINE_START':
                    this.apoProgress = 10;
                    break;
                case 'PHASE2_COMPLETED':
                    this.apoProgress = 30;
                    break;
                case 'RISKS_COMPLETED':
                    this.apoProgress = 50;
                    break;
                case 'PWIN_COMPLETED':
                    this.apoProgress = 70;
                    break;
                case 'MATCHING_COMPLETED':
                    this.apoProgress = 85;
                    break;
                case 'APO_COMPLETED':
                    this.apoProgress = 100;
                    break;
                case 'PIPELINE_COMPLETED':
                    this.apoProgress = 100;
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Pipeline terminÃ©',
                        detail: 'Toutes les phases d\'extraction et le scoring sont terminÃ©s avec succÃ¨s.'
                    });
                    this.sseService.disconnect(this.projectId!);
                    break;
                case 'PIPELINE_STOPPED_NOGO':
                case 'PIPELINE_ERROR':
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Attention',
                        detail: 'Le pipeline s\'est arrÃªtÃ© ou a rencontrÃ© une erreur.'
                    });
                    this.sseService.disconnect(this.projectId!);
                    break;
            }
        });
    }


    // â”€â”€ STEP 4: PrioritÃ© â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    updateManualPriority(): void {
        if (!this.projectId) return;

        this.projectsService.updatePriority(this.projectId, this.manualPriority).subscribe({
            next: (projectModifie) => {
                this.projectBackendData = projectModifie;
                this.priorityOverride = projectModifie.priorityOverride;
                
                // Ajouter au log d'audit
                this.auditLog.unshift({
                    date: new Date(),
                    author: 'Analyste (Manuel)',
                    action: 'ForÃ§age PrioritÃ©',
                    details: `PrioritÃ© modifiÃ©e de P${this.autoPriority} Ã  P${this.manualPriority}`
                });

                this.messageService.add({
                    severity: 'success',
                    summary: 'PrioritÃ© modifiÃ©e',
                    detail: `Le dossier est maintenant classÃ© P${this.manualPriority}.`
                });
            },
            error: () => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur prioritÃ©',
                    detail: 'Impossible de forcer la prioritÃ© en BDD.'
                });
            }
        });
    }

    // â”€â”€ STEP 5: IndexÃ© (TÃ©lÃ©chargements) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    exportDocx(): void {
        if (!this.projectId) return;
        
        this.projectsService.exportApoDocx(this.projectId).subscribe({
            next: (path) => {
                const url = `/api/export/download?path=${encodeURIComponent(path)}`;
                window.open(url, '_blank');
                this.messageService.add({ severity: 'success', summary: 'Téléchargé', detail: 'Fichier Word généré avec succès.' });
            },
            error: (err) => {
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de tÃ©lÃ©charger le document Word.' });
            }
        });
    }

    exportPdfSummary(): void {
        if (!this.projectId) return;

        this.projectsService.getDownloadUrl(this.projectId, 'recapitulatif').subscribe({
            next: (res) => {
                if (res && res.url) {
                    window.open(res.url, '_blank');
                    this.messageService.add({ severity: 'success', summary: 'TÃ©lÃ©chargÃ©', detail: 'Fichier PDF ouvert.' });
                }
            },
            error: () => {
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de gÃ©nÃ©rer le RÃ©capitulatif PDF.' });
            }
        });
    }

    resetWorkflow(): void {
        this.pollingSub?.unsubscribe();
        this.projectId = null;
        this.projectBackendData = null;
        this.fileAP = null;
        this.fileTDR = null;
        this.projectTitle = '';
        this.dateLimiteSaisie = '';
        this.currentStatus = '';
        this.isExtracting = false;
        this.isUploading = false;
        this.uploadProgress = 0;
        this.verticalStepStates = ['waiting', 'waiting', 'waiting', 'waiting', 'waiting', 'waiting', 'waiting'];
        this.initializeFields();
        this.navigateToStep(0);
    }
}
