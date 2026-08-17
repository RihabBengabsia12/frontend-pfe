import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { AnalystProjectsService } from '../../../service/analyst-projects.service';
import { ScoringService } from '../../../service/scoring.service';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PromptOverrideComponent } from '../shared/prompt-override/prompt-override.component';
import { SseService } from '../../../../services/sse.service';
import { NotificationStateService } from '../../../service/notification-state.service';

@Component({
    selector: 'app-rapport-final-page',
    templateUrl: './rapport-final-page.component.html',
    styleUrls: ['./rapport-final-page.component.scss'],
    providers: []
})
export class RapportFinalPageComponent implements OnInit, OnDestroy {
    @ViewChild('promptDrawer') promptDrawer!: PromptOverrideComponent;
    @ViewChild('docxContainerPackRapport') docxContainerPackRapport!: ElementRef;
    @ViewChild('docxContainerPackApo') docxContainerPackApo!: ElementRef;
    @ViewChild('docxContainerGeneral') docxContainerGeneral!: ElementRef;
    @ViewChild('docxContainer') docxContainer!: ElementRef;

    goToPhase(phase: number): void {
        if (!this.dossierId) return;
        if (phase === 1) this.router.navigate(['/dossiers', this.dossierId, 'validation-p1']);
        if (phase === 2) this.router.navigate(['/dossiers', this.dossierId, 'scoring']);
        if (phase === 3) this.router.navigate(['/dossiers', this.dossierId, 'matching']);
    }
    @ViewChild('docxContainerApoDocument') docxContainerApoDocument!: ElementRef;

    backMenuItems: any[] = [];
    dossierId: string = '';
    isLoading = false;
    today = new Date();
    isGenerating = false;
    displayModal = false;
    showTemplatePreview = false;
    templateBlob: Blob | null = null;
    validationTargets: any[] = [];
    
    progressValue = 0;
    loadingStep = 0;
    loadingMessages = [
        "Consolidation des données IA...",
        "Formatage du document officiel...",
        "Sauvegarde et génération du lien sécurisé..."
    ];

    // Data for visualization
    apoData: any = {};
    scoringData: any = {};
    matchingData: any = {};
    dossierData: any = {};

    // --- Copied from Matching ---
    tauxCompetences = 0;
    tauxExperts = 0;
    gapRefs: any[] = [];
    alignementStrategique = 'Non évalué';
    
    isPackDecisionnelGenerated = false;
    isGeneratingPackDecisionnel = false;
    isGeneratingRapportOnly = false;
    isGeneratingApoOnly = false;
    
    _lastGeneralReportBlob: Blob | null = null;
    _lastApoBlob: Blob | null = null;
    _lastPackBlob: Blob | null = null;
    
    showPackDialog = false;
    showZipDialog = false;
    packStep: 'zip' | 'ready' | 'error' = 'zip';
    packErrorMsg = '';
    targetManagerName = 'Manager';

    showApoPreviewDialog = false;
    showGeneralReportDialog = false;
    showApoDocumentDialog = false;
    isMethodologyGenerated = false;

    isApoDocumentLoading = false;
    apoDocumentLoadError = false;
    errorMessageApoDocument = '';

    generalDocxLoadError = false;
    errorMessageGeneralDocx = '';
    isGeneralDocxLoading = false;
    
    apoDocxLoadError = false;
    errorMessageApoDocx = '';

    isDocxLoading = false;
    docxLoadError = false;
    errorMessageForUI = '';
    showMethodologyLoadingDialog = false;
    private generatedMethodologyBlob?: Blob;

    isPhoneValidating = false;
    
    private sseSub?: Subscription;
    private generationSub?: Subscription;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private projectsService: AnalystProjectsService,
        private scoringService: ScoringService,
        private messageService: MessageService,
        private http: HttpClient,
        private sseService: SseService,
        private notificationStateService: NotificationStateService
    ) {}

    ngOnInit(): void {
        this.backMenuItems = [
            { label: 'Phase 3 : Matching', icon: 'pi pi-percentage', command: () => this.goToPhase(3) },
            { label: 'Phase 2 : Scoring', icon: 'pi pi-chart-bar', command: () => this.goToPhase(2) },
            { label: 'Phase 1 : Extraction & Validation', icon: 'pi pi-file-edit', command: () => this.goToPhase(1) }
        ];
        this.route.params.subscribe(params => {
            this.dossierId = params['id'];
            this.loadDossierData();
            this.loadActualTemplate();
            this.initSse();
        });
    }

    ngOnDestroy(): void {
        if (this.sseSub) {
            this.sseSub.unsubscribe();
        }
        if (this.generationSub) {
            this.generationSub.unsubscribe();
        }
    }

    private initSse(): void {
        this.sseService.connect(this.dossierId);
        this.sseSub = this.sseService.getEvents().subscribe(event => {
            if (event.type === 'APO_GENERATED') {
                if (this.isGeneratingPackDecisionnel) {
                    this.isGeneratingPackDecisionnel = false;
                    this.isPackDecisionnelGenerated = true;
                    this.showPackDialog = false;
                    this.loadPackPreviewDocx();
                    this.messageService.add({ severity: 'success', summary: 'Généré', detail: 'Documents générés avec succès' });
                }
                
                if (this.isGeneratingMethodology) {
                    this.isGeneratingMethodology = false;
                    this.isMethodologyGenerated = true;
                    this.isPackDecisionnelGenerated = false;
                    this.showMethodologyLoadingDialog = false;
                    this.messageService.add({ severity: 'success', summary: 'Généré', detail: 'Méthodologie assemblée.' });
                    this.loadDossierData();
                    this.showGeneratedMethodologyPreview();
                }
            } else if (event.type === 'PIPELINE_ERROR') {
                this.isGeneratingPackDecisionnel = false;
                this.isGeneratingMethodology = false;
                this.showPackDialog = false;
                this.showMethodologyLoadingDialog = false;
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: event.data || 'Erreur lors de la génération' });
            }
        });
    }

    safeParseJson(data: any, fallback: any): any {
        if (!data) return fallback;
        if (typeof data === 'string') {
            try { return JSON.parse(data); } catch { return fallback; }
        }
        return data;
    }

    loadActualTemplate(): void {
        this.projectsService.getTemplateDocx('Rapport-General-Template.docx').subscribe({
            next: (blob) => {
                this.templateBlob = blob;
            },
            error: (err) => {
                fetch('assets/Rapport-General-Template.docx')
                    .then(res => res.ok ? res.blob() : Promise.reject('Local file not found'))
                    .then(blob => { this.templateBlob = blob; })
                    .catch(e => console.error('No template found anywhere:', e));
            }
        });
    }

    onTemplateModalShow(): void {
        if (!this.templateBlob) return;
        setTimeout(() => {
            const container = document.getElementById('docx-preview-container');
            if (container) {
                container.innerHTML = '';
                import('docx-preview').then(docxPreview => {
                    docxPreview.renderAsync(this.templateBlob!, container, undefined, { className: 'docx' });
                });
            }
        }, 300);
    }

    dossierStatus: string = '';

    loadDossierData(): void {
        this.isLoading = true;
        forkJoin({
            dossier: this.projectsService.getDossier(this.dossierId).pipe(catchError(() => of(null))),
            extractionP2: this.projectsService.getExtractionP2(this.dossierId).pipe(catchError(() => of({}))),
            scoring: this.scoringService.getResult(this.dossierId).pipe(catchError(() => of({}))),
            matching: this.projectsService.getMatchingResult(this.dossierId).pipe(catchError(() => of({}))),
            matrix: this.projectsService.getMatchingMatrix(this.dossierId).pipe(catchError(() => of({})))
        }).subscribe({
            next: (data) => {
                this.dossierStatus = data.dossier?.status || '';
                this.dossierData = data.dossier || {};
                this.apoData = (data.extractionP2 as any)?.apoForm || data.extractionP2 || {};
                this.scoringData = data.scoring || {};
                
                const res = data.matching || {};
                const mtx = data.matrix || {};
                this.matchingData = res;
                
                // Set decision variables (like applyMatchingResult in Phase 3)
                this.tauxCompetences = res.tauxCouvertureCompetences ?? mtx.tauxCouvertureCompetences ?? 0;
                this.tauxExperts = res.tauxCouvertureExperts ?? mtx.tauxCouvertureExperts ?? 0;
                this.alignementStrategique = res.alignementStrategique ?? mtx.alignementStrategique ?? 'Non évalué';
                
                this.gapRefs = this.safeParseJson(res.gapRefs ?? mtx.gapRefs, []);
                if (!this.gapRefs || this.gapRefs.length === 0) {
                     this.gapRefs = this.safeParseJson(this.apoData.gapRefs, []);
                }

                const validationType = this.isCompatible() ? 'GO' : 'NOGO';
                this.projectsService.getValidationTargets(this.dossierId, validationType)
                    .pipe(catchError(() => of([])))
                    .subscribe((targets) => {
                        this.validationTargets = (targets as any)?.targets || targets || [];
                    });
                
                // Restaurer l'état généré si on recharge la page
                this.isMethodologyGenerated = !!this.dossierData?.methodoDocxPath;
                this.isPackDecisionnelGenerated = this.hasGeneratedPack();

                // Les livrables déjà générés ouvrent la vue d'envoi directement.
                // Un échec d'aperçu DOCX ne doit jamais bloquer le renvoi d'e-mail.
                if (['PENDING_VALIDATION', 'SUBMITTED', 'AUDIT'].includes(this.dossierStatus)) {
                    this.currentStep = 1;
                }
                
                this.isLoading = false;
            },
            error: () => {
                this.isLoading = false;
            }
        });
    }

    // --- Decision Logic ---
    getTauxCompetences(): number { return Math.round(this.tauxCompetences * 100); }
    getTauxExperts(): number { return Math.round(this.tauxExperts * 100); }
    
    calculateRefTaux(): number {
        if (!this.gapRefs || this.gapRefs.length === 0) return 0;
        let score = 0;
        for (const ref of this.gapRefs) {
            if (ref.couvert === 'OUI') score += 1;
            else if (ref.couvert === 'PARTIEL') score += 0.5;
        }
        return Math.round((score / this.gapRefs.length) * 100);
    }
    
    isAlignementOk(): boolean {
        return this.alignementStrategique !== 'Non aligné';
    }
    
    isCompatible(): boolean {
        return this.getTauxCompetences() >= 50 && this.calculateRefTaux() >= 50 && this.getTauxExperts() >= 40 && this.isAlignementOk();
    }

    hasGeneratedPack(): boolean {
        const statusReady = ['REPORT_GENERATED', 'PACK_READY', 'PENDING_VALIDATION', 'SUBMITTED', 'AUDIT', 'ARCHIVED']
            .includes(this.dossierStatus);
        const hasDocuments = !!this.dossierData?.apoDocxPath && !!this.dossierData?.rapportPath;
        return statusReady || !!this.dossierData?.packZipPath || hasDocuments;
    }

    // --- Generation Actions ---
    generateRapport(): void {
        this.displayModal = true;
        this.isGenerating = true;
        this.progressValue = 0;
        this.loadingStep = 0;
        const interval = setInterval(() => {
            this.progressValue += 15;
            if (this.progressValue >= 33) this.loadingStep = 1;
            if (this.progressValue >= 66) this.loadingStep = 2;
            if (this.progressValue >= 100) {
                this.progressValue = 100;
                clearInterval(interval);
                this.finalizeGeneration();
            }
        }, 300);
    }

    generatedReportPath: string | null = null;

    private finalizeGeneration(): void {
        this.projectsService.exportRapportFinal(this.dossierId).subscribe({
            next: (path) => {
                this.displayModal = false;
                this.isGenerating = false;
                this.generatedReportPath = path;
                this.messageService.add({ severity: 'success', summary: 'Rapport Généré', detail: 'Succès' });
            },
            error: () => {
                this.displayModal = false;
                this.isGenerating = false;
            }
        });
    }

    downloadReport(): void {
        if (this.generatedReportPath) {
            window.open('/api/export/download?path=' + encodeURIComponent(this.generatedReportPath), '_blank');
        }
    }

    continueToApo(): void {
        this.router.navigate(['/analyst/projects', this.dossierId, 'apo-editor']);
    }

    continueToPack(): void {
        this.router.navigate(['/analyst/projects', this.dossierId, 'pack']);
    }
    



    showDocxPreview(): void {
        this.showApoPreviewDialog = true;
        this.isMethodologyGenerated = false;
        this.isGeneratingMethodology = false;
        this.isDocxLoading = true;
        this.docxLoadError = false;
        this.errorMessageForUI = '';

        const templateToFetch = 'Methodologie-Template1.docx';

        this.projectsService.getTemplateDocx(templateToFetch).subscribe({
            next: (blob) => {
                if (blob.type.includes('html') || blob.size < 100) {
                    console.error('Blob is too small, likely an error page.');
                    this.errorMessageForUI = 'Le backend a renvoyé un fichier invalide ou vide (' + blob.size + ' octets). Type: ' + blob.type;
                    this.docxLoadError = true;
                    this.isDocxLoading = false;
                    return;
                }
                
                setTimeout(() => {
                    if (this.docxContainer && this.docxContainer.nativeElement) {
                        try {
                            this.docxContainer.nativeElement.innerHTML = ''; // clear previous
                            import('docx-preview').then(docxPreview => {
                                docxPreview.renderAsync(blob, this.docxContainer.nativeElement, null, {
                                    className: 'docx',
                                    inWrapper: true,
                                    ignoreWidth: false,
                                    ignoreHeight: false,
                                    ignoreFonts: false,
                                    breakPages: true,
                                    ignoreLastRenderedPageBreak: true,
                                    experimental: true,
                                    trimXmlDeclaration: true,
                                    debug: false,
                                }).then(() => {
                                    this.isDocxLoading = false;
                                }).catch(err => {
                                    console.error('Error rendering docx', err);
                                    this.errorMessageForUI = 'Erreur lors de la lecture du DOCX.';
                                    this.docxLoadError = true;
                                    this.isDocxLoading = false;
                                });
                            });
                        } catch (e: any) {
                            console.error('Exception rendering docx', e);
                            this.errorMessageForUI = 'Exception Javascript : ' + (e.message || 'Erreur inconnue');
                            this.docxLoadError = true;
                            this.isDocxLoading = false;
                        }
                    } else {
                        this.errorMessageForUI = 'Le conteneur HTML du document est introuvable.';
                        this.docxLoadError = true;
                        this.isDocxLoading = false;
                    }
                }, 400);
            },
            error: (err) => {
                console.error('API Error fetching DOCX', err);
                this.errorMessageForUI = 'Erreur réseau/API : ' + (err.message || 'Impossible de contacter le serveur');
                this.docxLoadError = true;
                this.isDocxLoading = false;
            }
        });
    }
    
    downloadDocxTemplate(): void {
        this.projectsService.getTemplateDocx('Methodologie-Template1.docx').subscribe({
            next: (blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'Trame_Methodologique_Vierge.docx';
                a.click();
                window.URL.revokeObjectURL(url);
            }
        });
    }
    
    isGeneratingMethodology = false;

    generateMethodology(): void {
        if (this.isGeneratingMethodology) return;

        this.isGeneratingMethodology = true;
        this.showMethodologyLoadingDialog = true;
        this.generationSub = this.projectsService.assembleApo(this.dossierId).subscribe({
            next: () => this.messageService.add({
                severity: 'info',
                summary: 'Génération lancée',
                detail: 'La méthodologie est en cours de génération.'
            }),
            error: (error) => {
                this.isGeneratingMethodology = false;
                this.showMethodologyLoadingDialog = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Génération impossible',
                    detail: error?.error?.message || 'La méthodologie n’a pas pu être générée.'
                });
            }
        });
    }

    viewGeneratedMethodology(): void {
        this.showGeneratedMethodologyPreview();
    }

    private showGeneratedMethodologyPreview(): void {
        this.showApoPreviewDialog = true;
        this.isDocxLoading = true;
        this.docxLoadError = false;
        this.errorMessageForUI = '';

        this.http.get(`/api/dossiers/${this.dossierId}/download/methodo/blob`, { responseType: 'blob' }).subscribe({
            next: (blob) => {
                if (blob.size < 100) {
                    this.errorMessageForUI = 'Le document généré est vide ou invalide.';
                    this.docxLoadError = true;
                    this.isDocxLoading = false;
                    return;
                }
                this.generatedMethodologyBlob = blob;
                setTimeout(() => this.renderMethodologyDocx(blob), 300);
            },
            error: (primaryError) => {
                const path = this.dossierData?.methodoDocxPath;
                if (path) {
                    this.http.get(`/api/export/download?path=${encodeURIComponent(path)}`, { responseType: 'blob' })
                        .subscribe({
                            next: (blob) => {
                                this.generatedMethodologyBlob = blob;
                                setTimeout(() => this.renderMethodologyDocx(blob), 300);
                            },
                            error: () => this.showMethodologyLoadError()
                        });
                    return;
                }
                this.showMethodologyLoadError(primaryError);
            }
        });
    }

    private showMethodologyLoadError(error?: any): void {
        const detail = error?.status ? ` (erreur serveur ${error.status})` : '';
        this.errorMessageForUI = `Impossible de charger la méthodologie générée${detail}. Le document n’est probablement pas encore enregistré dans le dossier.`;
        this.docxLoadError = true;
        this.isDocxLoading = false;
    }

    private renderMethodologyDocx(blob: Blob): void {
        if (!this.docxContainer?.nativeElement) {
            this.errorMessageForUI = 'La zone d’aperçu est indisponible.';
            this.docxLoadError = true;
            this.isDocxLoading = false;
            return;
        }
        this.docxContainer.nativeElement.innerHTML = '';
        import('docx-preview').then(docxPreview =>
            docxPreview.renderAsync(blob, this.docxContainer.nativeElement, undefined, {
                className: 'docx', inWrapper: true, breakPages: true
            })
        ).then(() => this.isDocxLoading = false)
         .catch(() => {
             this.errorMessageForUI = 'Erreur lors de l’affichage du DOCX généré.';
             this.docxLoadError = true;
             this.isDocxLoading = false;
         });
    }

    downloadGeneratedMethodology(): void {
        if (!this.generatedMethodologyBlob) return;
        const url = URL.createObjectURL(this.generatedMethodologyBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Methodologie_ProjectIQ.docx';
        link.click();
        URL.revokeObjectURL(url);
    }

    regenerateMethodologyOnly(): void {
        if (this.isGeneratingMethodology) return;
        this.isGeneratingMethodology = true;
        this.showMethodologyLoadingDialog = true;
        this.http.post(`/api/export/${this.dossierId}/methodologie`, {}, { responseType: 'blob' }).subscribe({
            next: (blob) => {
                this.isGeneratingMethodology = false;
                this.showMethodologyLoadingDialog = false;
                this.generatedMethodologyBlob = blob;
                this.showApoPreviewDialog = true;
                this.isDocxLoading = true;
                setTimeout(() => this.renderMethodologyDocx(blob), 300);
                this.messageService.add({ severity: 'success', summary: 'Méthodologie régénérée', detail: 'Seule la méthodologie a été régénérée.' });
            },
            error: () => {
                this.isGeneratingMethodology = false;
                this.showMethodologyLoadingDialog = false;
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'La méthodologie n’a pas pu être régénérée.' });
            }
        });
    }

    printGeneratedMethodology(): void {
        const content = this.docxContainer?.nativeElement?.innerHTML;
        if (!content) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(`<html><head><title>Méthodologie ProjectIQ</title><style>body{margin:20px;font-family:Arial,sans-serif}.docx-wrapper{background:#fff}.docx{max-width:100%}</style></head><body>${content}</body></html>`);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }

    generateDecisionPack(): void {
        if (this.hasGeneratedPack()) {
            this.isPackDecisionnelGenerated = true;
            this.currentStep = 1;
            this.loadPackPreviewDocx();
            return;
        }
        this.isPackDecisionnelGenerated = false;
        this.isGeneratingPackDecisionnel = true;
        
        // Afficher la fenêtre de chargement
        this.showPackDialog = true;
        this.packStep = 'zip';

        // 1. Appeler l'API d'assemblage du backend (Asynchrone, retourne 202)
        this.generationSub = this.projectsService.assembleApo(this.dossierId).subscribe({
            next: () => {
                // Le backend répond 202 immédiatement. L'état « généré » est mis
                // à jour exclusivement par l'événement SSE APO_GENERATED, une fois
                // les documents réels déposés dans MinIO et le pack construit.
                this.messageService.add({
                    severity: 'info',
                    summary: 'Génération en cours',
                    detail: 'Le pack sera disponible dès la confirmation du backend.'
                });
            },
            error: (err) => {
                this.isGeneratingPackDecisionnel = false;
                this.showPackDialog = false;
                
                let errorMsg = 'Echec de l\'assemblage backend';
                if (err.error && err.error.message) {
                    errorMsg = err.error.message;
                }
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: errorMsg });
            }
        });
    }

    cancelGeneration(): void {
        if (this.generationSub) {
            this.generationSub.unsubscribe();
        }
        this.showPackDialog = false;
        this.isGeneratingPackDecisionnel = false;
        this.messageService.add({ severity: 'info', summary: 'Annulé', detail: 'La génération a été annulée.' });
    }

    loadPackPreviewDocx(): void {
        this.isGeneratingRapportOnly = true;
        this.http.get(`/api/export/${this.dossierId}/general-report/download`, { responseType: 'blob' }).subscribe({
            next: (blob) => {
                this._lastGeneralReportBlob = blob;
                this.isGeneratingRapportOnly = false;
                this.generalDocxLoadError = false;
                setTimeout(() => {
                    if (this.docxContainerPackRapport) {
                        import('docx-preview').then(dp => dp.renderAsync(blob, this.docxContainerPackRapport.nativeElement));
                    }
                }, 300);
            },
            error: () => { this.isGeneratingRapportOnly = false; this.generalDocxLoadError = true; }
        });

        this.isGeneratingApoOnly = true;
        this.http.get(`/api/export/${this.dossierId}/apo-docx/download`, { responseType: 'blob' }).subscribe({
            next: (blob) => {
                this._lastApoBlob = blob;
                this.isGeneratingApoOnly = false;
                this.apoDocxLoadError = false;
                setTimeout(() => {
                    if (this.docxContainerPackApo) {
                        import('docx-preview').then(dp => dp.renderAsync(blob, this.docxContainerPackApo.nativeElement));
                    }
                }, 300);
            },
            error: () => { this.isGeneratingApoOnly = false; this.apoDocxLoadError = true; }
        });
    }

    currentStep = 0;

    prepareZipPackOnly(): void {
        this.showZipDialog = true;
        this.packStep = 'zip';
        const url = this.isCompatible()
            ? `/api/dossiers/${this.dossierId}/download/pack/blob`
            : `/api/export/${this.dossierId}/pack-nogo/download`;

        this.http.get(url, { responseType: 'blob' }).subscribe({
            next: (blob) => {
                this._lastPackBlob = blob;
                const objectUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = objectUrl;
                link.download = this.isCompatible()
                    ? 'Pack_Soumission_ProjectIQ.zip'
                    : 'Pack_NoGo_ProjectIQ.zip';
                link.click();
                URL.revokeObjectURL(objectUrl);
                this.packStep = 'ready';
                this.showZipDialog = false;
                this.messageService.add({
                    severity: 'success',
                    summary: 'Téléchargement prêt',
                    detail: this.isCompatible()
                        ? 'Le ZIP contient le rapport, l’APO et la méthodologie.'
                        : 'Le ZIP contient le rapport et l’APO.'
                });
            },
            error: () => {
                this.packStep = 'error';
                this.messageService.add({
                    severity: 'error',
                    summary: 'ZIP indisponible',
                    detail: 'Le pack n’est pas encore généré ou n’est plus accessible.'
                });
            }
        });
    }
    
    isSubmitting = false;

    submitToManager(): void {
        this.isSubmitting = true;
        if (!this.isCompatible()) {
            this.projectsService.notifyManagerNoGo(this.dossierId).subscribe({
                next: () => {
                    this.isSubmitting = false;
                    this.messageService.add({
                        severity: 'success',
                        summary: 'E-mail No-Go declenche',
                        detail: 'Le manager cible selon le budget a ete notifie.'
                    });
                    this.loadDossierData();
                },
                error: (error) => {
                    this.isSubmitting = false;
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Envoi non declenche',
                        detail: error?.error?.message || 'Impossible de notifier le manager.'
                    });
                }
            });
            return;
        }
        this.projectsService.sendToValidators(this.dossierId).subscribe({
            next: (targets) => {
                this.isSubmitting = false;
                const recipients = Array.isArray(targets)
                    ? targets.map(target => target.nom || target.role).filter(Boolean).join(', ')
                    : '';
                this.messageService.add({
                    severity: 'success',
                    summary: 'Envoi déclenché',
                    detail: recipients
                        ? `E-mail de validation envoyé à : ${recipients}.`
                        : 'E-mails de validation envoyés aux managers destinataires.'
                });
                this.dossierStatus = 'PENDING_VALIDATION';
                this.dossierData = { ...this.dossierData, status: 'PENDING_VALIDATION' };
                this.loadDossierData();
            },
            error: (error) => {
                this.isSubmitting = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Envoi non déclenché',
                    detail: error?.error?.message || 'Le pack doit être généré avant l’envoi aux managers.'
                });
            }
        });
    }
    
    

    simulatePhoneValidation(): void {
        this.isPhoneValidating = true;
        this.projectsService.updateStatus(this.dossierId, 'AUDIT').subscribe({
            next: () => {
                this.isPhoneValidating = false;
                this.dossierStatus = 'AUDIT';
                this.messageService.add({ severity: 'info', summary: 'Action requise', detail: 'Validation enregistrée. Veuillez générer le rapport d\'audit.', life: 5000 });
            },
            error: () => {
                this.isPhoneValidating = false;
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de mettre à jour le statut' });
            }
        });
    }

    goToAuditPage(): void {
        this.router.navigate(['/dossiers', this.dossierId, 'audit']);
    }
    
    downloadPack(): void {
        if (!this._lastPackBlob) return;
        const url = window.URL.createObjectURL(this._lastPackBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Pack_Decisionnel_NO-GO.zip';
        a.click();
    }
    
    showGeneralReportPreview(): void {
        this.showGeneralReportDialog = true;
        this.isGeneralDocxLoading = true;
        this.http.get(`/api/export/${this.dossierId}/general-report/download`, { responseType: 'blob' }).subscribe({
            next: (blob) => {
                this.isGeneralDocxLoading = false;
                this._lastGeneralReportBlob = blob;
                setTimeout(() => {
                    if (this.docxContainerGeneral) {
                        import('docx-preview').then(dp => dp.renderAsync(blob, this.docxContainerGeneral.nativeElement));
                    }
                }, 300);
            },
            error: () => { this.isGeneralDocxLoading = false; this.generalDocxLoadError = true; }
        });
    }

    showApoPreview(): void {
        this.showApoDocumentDialog = true;
        this.isApoDocumentLoading = true;
        this.http.get(`/api/export/${this.dossierId}/apo-docx/download`, { responseType: 'blob' }).subscribe({
            next: (blob) => {
                this.isApoDocumentLoading = false;
                this._lastApoBlob = blob;
                setTimeout(() => {
                    if (this.docxContainerApoDocument) {
                        import('docx-preview').then(dp => dp.renderAsync(blob, this.docxContainerApoDocument.nativeElement));
                    }
                }, 300);
            },
            error: () => { this.isApoDocumentLoading = false; this.apoDocumentLoadError = true; }
        });
    }

    regenerateApoOnly(): void {
        this.showApoPreview();
        this.messageService.add({ severity: 'success', summary: 'APO régénéré', detail: 'Seul le document APO a été régénéré.' });
    }

    regenerateGeneralReportOnly(): void {
        this.showGeneralReportPreview();
        this.messageService.add({ severity: 'success', summary: 'Rapport régénéré', detail: 'Seul le rapport général a été régénéré.' });
    }

    downloadGeneralReportDocx(): void {
        if (this._lastGeneralReportBlob) {
            const url = window.URL.createObjectURL(this._lastGeneralReportBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Rapport_General.docx';
            a.click();
        }
    }
    
    printGeneralReport(): void { window.print(); }

    downloadApoDocumentDocx(): void {
        if (this._lastApoBlob) {
            const url = window.URL.createObjectURL(this._lastApoBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Methodologie_APO.docx';
            a.click();
        }
    }
    printApoDocument(): void { window.print(); }
}


