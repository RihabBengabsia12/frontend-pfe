import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as docx from 'docx-preview';
import { AnalystProjectsService, ApoForm } from '../../../service/analyst-projects.service';

export interface MatriceRow {
    critere: string;
    positionEgis: 'COUVERT' | 'PARTIELLEMENT' | 'NON_COUVERT' | 'VIA_PARTENAIRE';
    argumentGap: string;
}

export interface CompetenceDetail {
    domaine?: string;
    libelle?: string;
    niveauReferentiel?: string;
    niveauEgis?: string;
    score?: number;
    couvert?: boolean;
}

export interface GapRefRow {
    exigence: string;
    reference: string;
    couvert: 'OUI' | 'NON' | 'PARTIEL';
}

export interface ExpertRow {
    profil: string;
    expert: string;
    disponible: boolean;
    hm?: number;
}

export interface RequirementsResponseDto {
    references: string[];
    experts: { role: string; hm: number }[];
    secteur: string;
    typeContrat: string;
    qualifications: string[];
}

@Component({
    selector: 'app-analyst-matching',
    templateUrl: './analyst-matching.component.html',
    styleUrls: ['./analyst-matching.component.scss'],
    providers: [MessageService]
})
export class AnalystMatchingComponent implements OnInit {

    dossierId = '';
    isLoading = true;
    isRunningMatching = false;
    hasMatchingData = false;
    matchingLoadError = '';
    isConsultation = false;
    isFinalLocked = false;

    dossierStatus = '';
    referentielReady = false;

    // Pipeline Steps
    matchingProgressStep = 0;
    extractedRequirements: RequirementsResponseDto | null = null;

    // Synthèse
    tauxCompetences = 0; // 0 to 1
    tauxExperts = 0;     // 0 to 1
    relationNiveau = 1;
    relationNbMissions = 0;
    secteurAo = 'Non défini';
    alignementStrategique = 'Non évalué';
    typeContrat = '—';
    conditionsResiliation = '—';
    relationClientLabel = '';

    // Tab state
    activeTab = 0;

    competencesDetail: CompetenceDetail[] = [];
    gapRefs: GapRefRow[] = [];
    expertsDetail: ExpertRow[] = [];
    matriceRows: MatriceRow[] = [];

    // Champs APO groupés
    partenaires = '';
    chefDeFile = '';
    
    // Pour badges sources
    apoSources: { [key: string]: string } = {
        'SECTEUR_AO': '88% Claude',
        'TYPE_CONTRAT': '91% Claude'
    };

    private extractionP2Data: any = null;

    // Matrice édition
    editingRows: { [key: number]: boolean } = {};
    positions = [
        { label: '✓ Couvert', value: 'COUVERT' },
        { label: '≈ Partiellement', value: 'PARTIELLEMENT' },
        { label: '✗ Non couvert', value: 'NON_COUVERT' },
        { label: '↗ Via partenaire', value: 'VIA_PARTENAIRE' }
    ];

    // Dropdowns
    secteursList = ['Eau & Assainissement', 'Transport', 'Énergie', 'Urbain', 'Agriculture', 'Environnement', 'Social', 'Autre'];
    typeContratsList = ['Forfait', 'Régie', 'Prix unitaires', 'Mixte', 'Assistance Technique (AT)', 'Autre'];
    alignementList = ['Oui — aligné', 'Partiel', 'Non aligné'];
    relationClientList = ['Premier contact', 'Missions passées', 'Client fidèle'];
    chefDeFileList = ['Notre cabinet', 'Partenaire', 'Notre cabinet / Partenaire'];

    showApoPreviewDialog = false;
    isDocxLoading = false;
    docxLoadError = false;
    errorMessageForUI = '';
    @ViewChild('docxContainer', { static: false }) docxContainer!: ElementRef;

    isMethodologyGenerated = false;
    isGeneratingMethodology = false;
    generatedMethodology = {
        section1: '',
        section2: '',
        section3: '',
        section4: '',
        section5: ''
    };

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private projectsService: AnalystProjectsService,
        private messageService: MessageService
    ) {}

    ngOnInit(): void {
        this.route.params.subscribe(params => {
            this.dossierId = params['id'] || '';
            if (this.dossierId) {
                localStorage.setItem('lastProjectId', this.dossierId);
                this.bootstrapPage();
            }
        });
    }

    bootstrapPage(): void {
        this.isLoading = true;
        this.matchingLoadError = '';
        forkJoin({
            dossier: this.projectsService.getDossier(this.dossierId).pipe(catchError(() => of(null))),
            referentiel: forkJoin({
                competences: this.projectsService.getReferentielCompetences(),
                references: this.projectsService.getReferentielReferences(),
                experts: this.projectsService.getReferentielExperts(),
                qualifications: this.projectsService.getReferentielQualifications()
            }),
            extractionP2: this.projectsService.getExtractionP2(this.dossierId).pipe(catchError(() => of(null))),
            matching: this.projectsService.getMatchingResult(this.dossierId).pipe(catchError((error) => {
                this.matchingLoadError = this.readMatchingError(error);
                return of(null);
            })),
            matrix: this.projectsService.getMatchingMatrix(this.dossierId).pipe(catchError((error) => {
                this.matchingLoadError = this.matchingLoadError || this.readMatchingError(error);
                return of(null);
            }))
        }).subscribe({
            next: (data) => {
                this.applyDossierContext(data.dossier);
                this.referentielReady = true;
                this.extractionP2Data = data.extractionP2;
                this.applyMatchingResult(data.matching, data.matrix);
                this.isLoading = false;
            },
            error: () => {
                this.matchingLoadError = 'Impossible de charger les données nécessaires à la Phase 3.';
                this.isLoading = false;
            }
        });
    }

    private readMatchingError(error: any): string {
        if (error?.status === 401 || error?.status === 403) {
            return 'Votre session ne permet pas de consulter le matching. Reconnectez-vous puis réessayez.';
        }
        if (error?.status === 404) {
            return 'Aucun résultat de matching sauvegardé n’a été trouvé pour ce dossier.';
        }
        return error?.error?.message || 'Impossible de relire le résultat de matching sauvegardé.';
    }

    private applyDossierContext(dossier: any): void {
        this.dossierStatus = dossier?.status || '';
        this.isConsultation = ['DRAFTING', 'REPORT_GENERATED', 'PACK_READY',
            'PENDING_VALIDATION', 'SUBMITTED', 'AUDIT', 'ARCHIVED'].includes(this.dossierStatus);
        this.isFinalLocked = ['SUBMITTED', 'AUDIT', 'ARCHIVED'].includes(this.dossierStatus);
    }

    startRevalidation(): void {
        if (this.isFinalLocked) return;
        this.isConsultation = false;
        this.messageService.add({ severity: 'info', summary: 'Révalidation P3', detail: 'La matrice est déverrouillée. Enregistrez chaque ligne modifiée.' });
    }

    private applyMatchingResult(matching: any, matrix: any): void {
        const res = matching ?? {};
        const mtx = matrix ?? {};

        if (!matching && !matrix) {
            this.hasMatchingData = false;
            return;
        }

        this.hasMatchingData = true;

        this.tauxCompetences = res.tauxCouvertureCompetences ?? mtx.tauxCouvertureCompetences ?? 0;
        this.tauxExperts = res.tauxCouvertureExperts ?? mtx.tauxCouvertureExperts ?? 0;
        
        this.secteurAo = res.secteurAo || mtx.secteurAo || 'Non défini';
        this.alignementStrategique = res.alignementStrategique || mtx.alignementStrategique || 'Non évalué';
        this.typeContrat = res.typeContrat || '—';

        // Load details
        const rawCompetences = this.safeParseJson(res.competencesDetail, []);
        if (Array.isArray(rawCompetences) && rawCompetences.length > 0 && rawCompetences[0].score !== undefined) {
            this.competencesDetail = rawCompetences.map((c: any) => ({
                ...c,
                score: c.score <= 1 ? Math.round(c.score * 100) : Math.round(c.score)
            }));
        } else if (Array.isArray(rawCompetences)) {
            this.competencesDetail = rawCompetences.map((c: any) => ({
                domaine: c.domaine,
                niveauReferentiel: c.niveauEgis,
                score: c.couvert ? Math.round(70 + Math.random() * 25) : Math.round(20 + Math.random() * 40),
                couvert: c.couvert
            }));
        }

        this.expertsDetail = this.safeParseJson(res.expertsDetail, []);
        this.gapRefs = this.safeParseJson(res.gapRefs || mtx.gapRefs, []);

        const storedMatrix = localStorage.getItem(`matching_matrix_${this.dossierId}`);
        if (storedMatrix) {
            this.matriceRows = JSON.parse(storedMatrix);
        } else {
            this.matriceRows = this.safeParseJson(res.matriceDiff || mtx.matriceDiff, []);
        }

        const apo = this.extractionP2Data?.apoForm ?? this.extractionP2Data ?? {};
        this.partenaires = apo.partenaires || mtx.partenaires || '';
        this.chefDeFile = apo.chefDeFile || mtx.chefDeFile || '';

        // Remplir extractedRequirements pour l'affichage (depuis MatchingResult)
        if (res) {
            this.extractedRequirements = {
                references: this.safeParseJson(res.refsExigees, []),
                experts: this.safeParseJson(res.expertsRequis, []),
                qualifications: this.safeParseJson(res.qualifsExigees, []),
                secteur: res.secteurAo || '',
                typeContrat: res.typeContrat || ''
            };
        }
    }



    setActiveTab(index: number): void {
        this.activeTab = index;
    }



    goToFinalisation(): void {
        this.projectsService.updateStatus(this.dossierId, 'DRAFTING').subscribe({
            next: () => this.router.navigate(['/dossiers', this.dossierId, 'rapport-final']),
            error: () => this.router.navigate(['/dossiers', this.dossierId, 'rapport-final'])
        });
    }

    runMatching(): void {
        this.isRunningMatching = true;
        this.matchingProgressStep = 1;

        const progressTimer = setInterval(() => {
            if (this.matchingProgressStep < 4) {
                this.matchingProgressStep++;
            }
        }, 3000);

        this.projectsService.runMatching(this.dossierId).subscribe({
            next: () => {
                clearInterval(progressTimer);
                this.matchingProgressStep = 5;
                
                setTimeout(() => {
                    this.isRunningMatching = false;
                    this.dossierStatus = 'MATCHING';
                    localStorage.removeItem(`matching_matrix_${this.dossierId}`);

                    this.messageService.add({ severity: 'success', summary: 'Phase 3 complétée', detail: 'Matrice de différenciation générée.' });
                    this.bootstrapPage();
                }, 1000);
            },
            error: (err) => {
                clearInterval(progressTimer);
                this.isRunningMatching = false;
                this.matchingProgressStep = 0;
                this.messageService.add({ severity: 'error', summary: 'Échec du matching', detail: err?.error?.message || 'Erreur API.' });
            }
        });
    }

    recalculateMatching(): void {
        if (this.isFinalLocked) return;
        this.messageService.add({ severity: 'info', summary: 'Recalcul', detail: 'Recalcul du matching en cours...' });
        this.projectsService.recalculateMatching(this.dossierId).subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Recalcul terminé.' });
                this.bootstrapPage();
            },
            error: (err) => {
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Échec du recalcul.' });
            }
        });
    }

    // --- Formatters & Helpers ---
    
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

    getDispoExpertsCount(): number {
        return this.expertsDetail.filter(e => e.disponible).length;
    }

    // --- Pipeline Styles ---
    getStepClass(step: number): string {
        if (this.matchingProgressStep === step) return 'step-active';
        if (this.matchingProgressStep > step) return 'step-done';
        return '';
    }
    getConnectorClass(step: number): string {
        if (this.matchingProgressStep === step) return 'conn-active';
        if (this.matchingProgressStep > step) return 'conn-done';
        return '';
    }

    onPipelineClick(step: number): void {
        if (!this.hasMatchingData) return;
        switch(step) {
            case 1:
                document.getElementById('pipeline-section')?.scrollIntoView({ behavior: 'smooth' });
                break;
            case 2:
                this.setActiveTab(0);
                document.getElementById('tabs-section')?.scrollIntoView({ behavior: 'smooth' });
                break;
            case 3:
                this.setActiveTab(1);
                document.getElementById('tabs-section')?.scrollIntoView({ behavior: 'smooth' });
                break;
            case 4:
                this.setActiveTab(2);
                document.getElementById('tabs-section')?.scrollIntoView({ behavior: 'smooth' });
                break;
            case 5:
                document.getElementById('matrix-section')?.scrollIntoView({ behavior: 'smooth' });
                break;
        }
    }

    // --- Table Styles ---
    getScoreColor(score: number | undefined): string {
        if (!score) return '#6b7280';
        if (score >= 70) return '#10b981';
        if (score >= 40) return '#f59e0b';
        return '#ef4444';
    }

    getScoreGradient(score: number | undefined): string {
        if (!score) return 'transparent';
        if (score >= 70) return 'linear-gradient(90deg, #34d399, #10b981)';
        if (score >= 40) return 'linear-gradient(90deg, #fcd34d, #f59e0b)';
        return 'linear-gradient(90deg, #fca5a5, #ef4444)';
    }

    getRefStatusClass(status: string): string {
        if (status === 'OUI') return 'pill-green';
        if (status === 'PARTIEL') return 'pill-amber';
        return 'pill-red';
    }
    getRefStatusIcon(status: string): string {
        if (status === 'OUI') return 'pi pi-check';
        if (status === 'PARTIEL') return 'pi pi-minus';
        return 'pi pi-times';
    }
    getRefStatusLabel(status: string): string {
        if (status === 'OUI') return '✓ OUI';
        if (status === 'PARTIEL') return '≈ PARTIEL';
        return '✗ NON';
    }

    getMatrixPosClass(pos: string): string {
        switch (pos) {
            case 'COUVERT': return 'pos-couvert';
            case 'PARTIELLEMENT': return 'pos-partiel';
            case 'VIA_PARTENAIRE': return 'pos-partenaire';
            default: return 'pos-gap';
        }
    }
    getMatrixPosTextClass(pos: string): string {
        switch (pos) {
            case 'COUVERT': return 'text-couvert';
            case 'PARTIELLEMENT': return 'text-partiel';
            case 'VIA_PARTENAIRE': return 'text-partenaire';
            default: return 'text-gap';
        }
    }
    getMatrixPosIcon(pos: string): string {
        switch (pos) {
            case 'COUVERT': return 'pi pi-check-circle';
            case 'PARTIELLEMENT': return 'pi pi-minus-circle';
            case 'VIA_PARTENAIRE': return 'pi pi-users';
            default: return 'pi pi-times-circle';
        }
    }
    getMatrixPosLabel(pos: string): string {
        switch (pos) {
            case 'COUVERT': return '✓ Couvert';
            case 'PARTIELLEMENT': return '≈ Partiel';
            case 'VIA_PARTENAIRE': return '↗ Partenaire';
            default: return '✗ Non couvert';
        }
    }

    getStatusClass(): string {
        const s = this.dossierStatus.toUpperCase();
        if (s.includes('MATCHING') || s.includes('DRAFTING')) return 'badge-pastel-green';
        return 'badge-pastel-blue';
    }
    getStatusLabel(): string {
        return this.dossierStatus === 'MATCHING' ? 'Terminé' : 'En attente';
    }

    // --- Matrice Edition ---
    getMatrixCoverage(): number {
        if (!this.matriceRows || this.matriceRows.length === 0) return 0;
        let covered = 0;
        for (const row of this.matriceRows) {
            if (row.positionEgis === 'COUVERT') covered += 1;
            else if (row.positionEgis === 'PARTIELLEMENT' || row.positionEgis === 'VIA_PARTENAIRE') covered += 0.5;
        }
        return Math.round((covered / this.matriceRows.length) * 100);
    }
    getCoveredCount(): number {
        return this.matriceRows.filter(r => r.positionEgis === 'COUVERT' || r.positionEgis === 'VIA_PARTENAIRE').length;
    }

    editRow(index: number): void { this.editingRows[index] = true; }
    saveRow(index: number): void {
        this.editingRows[index] = false;
        this.projectsService.updateMatchingMatrix(this.dossierId, this.matriceRows).subscribe({
            next: () => {
                localStorage.removeItem(`matching_matrix_${this.dossierId}`);
                this.messageService.add({ severity: 'success', summary: 'Matrice enregistrée', detail: 'La correction est sauvegardée en base.' });
            },
            error: (error) => {
                this.editingRows[index] = true;
                this.messageService.add({ severity: 'error', summary: 'Enregistrement impossible', detail: error?.error?.message || 'La correction n’a pas été sauvegardée.' });
            }
        });
    }
    addRow(): void {
        this.matriceRows.push({ critere: 'Nouveau critère', positionEgis: 'COUVERT', argumentGap: '' });
        this.editRow(this.matriceRows.length - 1);
    }
    onPositionChange(index: number, value: string): void {}

    // --- Champs Strat ---
    updateField(fieldName: string, value: string): void {
        if (!this.dossierId || !value) return;
        
        // Mettre à jour localement pour l'aperçu APO
        if (this.extractionP2Data) {
            if (this.extractionP2Data.apoForm) {
                this.extractionP2Data.apoForm[fieldName] = value;
            } else {
                this.extractionP2Data[fieldName] = value;
            }
        }
        
        this.projectsService.updateApoField(this.dossierId, fieldName, value).subscribe();
    }
    updateRelationClient(value: string): void {
        const levelIndex = this.relationClientList.indexOf(value);
        let level = 1;
        if (levelIndex === 2) level = 5; 
        else if (levelIndex === 1) level = 3;
        this.updateField('RELATION_CLIENT', level.toString());
    }

    // --- Décision ---
    isAlignementOk(): boolean {
        return this.alignementStrategique !== 'Non aligné';
    }
    isCompatible(): boolean {
        return this.getTauxCompetences() >= 50 && this.calculateRefTaux() >= 50 && this.getTauxExperts() >= 40 && this.isAlignementOk();
    }

    generateMethodology(): void {
        // Bypass AI generation to save tokens as requested by user
        this.messageService.add({ severity: 'success', summary: 'Mode Éco', detail: 'Passage direct à la finalisation (sans consommer de tokens).' });
        this.projectsService.updateStatus(this.dossierId, 'DRAFTING').subscribe({
            next: () => this.router.navigate(['/dossiers', this.dossierId, 'rapport-final']),
            error: () => this.router.navigate(['/dossiers', this.dossierId, 'rapport-final'])
        });
    }

    confirmNoGo(): void {
        this.projectsService.confirmNoGo(this.dossierId).subscribe({
            next: () => {
                this.projectsService.generateNoGoReport(this.dossierId).subscribe({
                    next: () => {
                        this.messageService.add({ severity: 'success', summary: 'No-Go Confirmé', detail: 'Rapport généré.' });
                        this.router.navigate(['/dossiers', this.dossierId, 'no-go-report']);
                    }
                });
            }
        });
    }

    forceCompatible(): void {
        this.projectsService.forceCompatible(this.dossierId, 'Décision forcée par l\'analyste').subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Forçage réussi', detail: 'Le dossier passe en drafting méthodologie.' });
                this.generateMethodology();
            }
        });
    }

    private safeParseJson(data: any, fallback: any): any {
        if (!data) return fallback;
        if (typeof data === 'object') return data;
        try { return JSON.parse(data); } catch { return fallback; }
    }

    getApoPreviewData(): Record<string, string> {
        return this.extractionP2Data?.apoForm ?? this.extractionP2Data ?? {};
    }

    showDocxPreview(): void {
        this.showApoPreviewDialog = true;
        this.isMethodologyGenerated = false;
        this.isGeneratingMethodology = false;
        this.isDocxLoading = true;
        this.docxLoadError = false;
        this.errorMessageForUI = '';

        // On va chercher "Methodologie-Template1.docx" car c'est votre VRAI fichier non vide !
        // (L'autre étant verrouillé par le serveur backend).
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
                            docx.renderAsync(blob, this.docxContainer.nativeElement, null, {
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
                                this.errorMessageForUI = 'Erreur lors de la lecture du DOCX (fichier corrompu ou format non supporté).';
                                this.docxLoadError = true;
                                this.isDocxLoading = false;
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
        this.projectsService.getTemplateDocx('Methodologie-Template1.docx').subscribe(blob => {
            this.projectsService.triggerBrowserDownload(blob, 'Methodologie-Template1.docx');
        });
    }
}
