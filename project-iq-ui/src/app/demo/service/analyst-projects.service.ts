import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

// ─────────────────────────────────────────────────────────────────────────────
// Dossier — Entité principale (project-service)
// Correspond à Dossier.java dans project-service
// ─────────────────────────────────────────────────────────────────────────────
export interface Dossier {
    id: string;
    pays?: string;
    intituleOffre?: string;
    client?: string;
    bailleurs?: string;
    budgetGlobal?: string;
    hommesMois?: number;
    dtLimSoum?: string;          // ISO date YYYY-MM-DD
    langue?: string;
    visiteObl?: boolean;
    visiteDate?: string;
    confObl?: boolean;
    confDate?: string;
    numeroReference?: string;
    status: string;              // DossierStatus enum
    priorite?: number;           // 1=Urgent 2=Modéré 3=Normal
    priorityOverride?: boolean;
    confianceP1?: number;
    pwinScore?: number;
    joursOuvrables?: number;
    tjmImplicite?: number;
    createdAt?: string;
    updatedAt?: string;
    isPrivate?: boolean;
    
    // MinIO Paths
    documentTextPath?: string;
    apoDocxPath?: string;
    methodoDocxPath?: string;
    rapportPath?: string;
    nogoReportPath?: string;
    packZipPath?: string;
    auditReportPath?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ExtractionMetadata — Résultat extraction Claude par champ
// Correspond à ExtractionMetadata.java
// ─────────────────────────────────────────────────────────────────────────────
export interface ExtractionMetadata {
    id?: string;
    dossierId?: string;
    fieldName: string;           // Ex: "PAYS", "DT_LIM_SOUM"
    valeurClaude?: string;
    valeurFinale?: string;
    confiance?: number;          // 0.0–1.0 (>= 0.85=vert | 0.60-0.84=ambre | <0.60=rouge)
    source?: string;
    humanModified?: boolean;
    sourceExtrait?: string;
    reextractionCount?: number;
    phase?: string;              // "P1" | "P2"
}

// ─────────────────────────────────────────────────────────────────────────────
// ValidateP1RequestDto — Corps de PUT /api/dossiers/{id}/validate-p1
// ─────────────────────────────────────────────────────────────────────────────
export interface ChampValide {
    valeur: string;
    humanModified?: boolean;
}

export interface ValidateP1RequestDto {
    champs: { [fieldName: string]: ChampValide };
    prioriteOverride?: number;
    numeroReference?: string;
    arriveBo?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ChampResult — Réponse de PUT /api/dossiers/{id}/reextract-field
// ─────────────────────────────────────────────────────────────────────────────
export interface ChampResult {
    valeur: any;
    confiance?: number;
    source?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// AuditEntry — Historique complet d'un dossier
// Correspond à AuditEntry.java
// ─────────────────────────────────────────────────────────────────────────────
export interface AuditEntry {
    id?: string;
    dossierId: string;
    action: string;
    acteur?: string;
    detail?: string;        // JSON string
    statusAvant?: string;
    statusApres?: string;
    timestamp: string;      // LocalDateTime
}

// ─────────────────────────────────────────────────────────────────────────────
// DossierStatus — Cycle de vie complet
// ─────────────────────────────────────────────────────────────────────────────
export type DossierStatus =
    'UPLOADED' | 'PARSING_INITIAL' | 'CORRECTION_LOOP' | 'INDEXED' |
    'DEEP_ANALYSIS' | 'SCORING' | 'MANUAL_INTERVENTION' | 'FORCE_GO' |
    'NO_GO_CONFIRMED' | 'MATCHING' | 'DRAFTING' | 'REPORT_GENERATED' |
    'PACK_READY' | 'PENDING_VALIDATION' | 'SUBMITTED' | 'AUDIT' | 'ARCHIVED' | 'ERROR';

export type AnalystProjectStatus = DossierStatus | string;

export interface AnalystProject {
    id: string;
    title: string;
    description?: string;
    fileName?: string;
    filePath?: string;
    status: AnalystProjectStatus;
    createdAt?: string;
    updatedAt?: string;
}

export interface AnalystAnalysisResult {
    id?: string;
    projectId?: string;
    extractedContent?: string;
    aiAnalysisJson?: string | any;
    createdAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Interface ApoForm — mappe l'entité Java ApoForm (tous les champs sont String)
// ─────────────────────────────────────────────────────────────────────────────
export interface ApoForm {
    id?: string;
    projectId?: string;

    // Onglet 1 – Informations Administratives
    pays?: string;
    intituleOffre?: string;
    numeroReference?: string;
    client?: string;
    langue?: string;
    dtLimSoum?: string;
    arriveeBo?: string;          // Java getter: getArriveeBo()
    transmission?: string;

    // Onglet 2 – Cadrage Financier & Délais
    bailleurs?: string;
    budgetGlobal?: string;       // Java getter: getBudgetGlobal() → String
    finLocalOuiNon?: string;     // "OUI" | "NON"
    finaLocalDetails?: string;
    delaiPrepSuf?: string;       // "OUI" | "NON"
    justifDelaiPrep?: string;
    dateLimiteSoumission?: string;
    delaiGlobalMois?: string;
    capaciteDelai?: string;      // "OUI" | "NON"
    justifCapaciteDelai?: string;
    modeNotation?: string;
    noteMinimale?: string;
    ponTech?: string;
    ponFin?: string;
    partenaires?: string;
    chefDeFile?: string;
    rolesRepartition?: string;
    cautionMonnaie?: string;
    cautionMontant?: string;
    cautionDuree?: string;
    banqueLocaleExigee?: string; // Java getter: getBanqueLocaleExigee()
    hommesMois?: string;
    budgetInterne?: string;
    sourceBudgetInterne?: string;

    // Onglet 3 – Concurrence & Clarifications
    shortlist?: string;
    shortlistEquilibree?: string; // "OUI" | "NON"
    justifShortlist?: string;
    analyseConcurrence?: string;
    dateLimiteQuestions?: string;
    listeClarifications?: string;
    visiteObl?: string;           // "OUI" | "NON"
    visiteDate?: string;
    confObl?: string;             // "OUI" | "NON"
    confDate?: string;

    // Onglet 4 – 10 Risques Non Maîtrisables
    risquePaysSecurite?: string;
    risquesFinanciers?: string;
    penalites?: string;
    exigencesTdrInacceptables?: string;
    guaranteesAssurancesElevees?: string; // Java: getGuaranteesAssurancesElevees()
    tailleDispersion?: string;
    fraisDiversEleves?: string;
    budgetFaibleHmLimites?: string;
    participationLocaleExcessive?: string;
    fiscaliteNonMaitrisee?: string;

    // Onglet 5 – Synthèse IA
    resumeContexteObjectifs?: string;
    pointsCritiques?: string;
    recommandationGoNoGo?: string;   // Java: getRecommandationGoNoGo()
    argumentaireGoNoGo?: string;     // Java: getArgumentaireGoNoGo()
    planAction?: string;

    // Workflow hiérarchique – Décisions humaines
    decisionDo?: string;       // Java: getDecisionDo()
    commentairesDo?: string;
    decisionDda?: string;
    commentairesDda?: string;
    decisionDga?: string;
    commentairesDga?: string;
    decisionPdg?: string;
    commentairesPdg?: string;
}

@Injectable({ providedIn: 'root' })
export class AnalystProjectsService {

    // ── Relative paths — handled by Angular proxy (proxy.conf.json) ──
    private readonly DOSSIERS_API    = '/api/dossiers';
    private readonly REFERENTIEL_API = '/api/analyses/referentiel';
    private readonly APO_API         = '/api/apo';

    constructor(private http: HttpClient) {}

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1 — Dossier (project-service, base: /api/dossiers)
    // ═══════════════════════════════════════════════════════════════════════

    /** POST /api/dossiers/upload — Dépose le TDR (PDF/DOCX) + date limite.
     *  Le backend lance l'extraction Claude IA en arrière-plan (async).
     *  Retourne immédiatement le Dossier avec statut UPLOADED.
     */
    uploadDossier(tdrFile: File, dateLimite: string, intitule?: string, isPrivate: boolean = false): Observable<any> {
        const form = new FormData();
        form.append('tdr', tdrFile);
        form.append('dateLimite', dateLimite); // Format ISO YYYY-MM-DD
        form.append('isPrivate', isPrivate.toString());
        if (intitule) {
            form.append('intitule', intitule);
        }
        return this.http.post<any>(`${this.DOSSIERS_API}/upload`, form, {
            reportProgress: true,
            observe: 'events'
        });
    }

    /** GET /api/dossiers/ai-logs — Logs IA Phase 1 */
    getAiLogs(): Observable<any[]> {
        return this.http.get<any[]>(`${this.DOSSIERS_API}/ai-logs`);
    }

    /** GET /api/dossiers — Liste triée par priorité et date limite */
    getAllDossiers(): Observable<Dossier[]> {
        return this.http.get<Dossier[]>(this.DOSSIERS_API).pipe(
            catchError(() => of([]))
        );
    }

    /** GET /api/dossiers/{id} */
    getDossier(id: string): Observable<Dossier> {
        return this.http.get<Dossier>(`${this.DOSSIERS_API}/${id}`);
    }

    /** GET /api/dossiers/{id}/status — Polling Angular (toutes les 3-5s).
     *  Retourne { dossierId, status, pwinScore, joursOuvrables, priorite }
     */
    pollStatus(id: string): Observable<any> {
        return this.http.get<any>(`${this.DOSSIERS_API}/${id}/status`);
    }

    /** PUT /api/dossiers/{id}/priority?priorite=1 */
    updatePriority(id: string, priorite: number): Observable<Dossier> {
        return this.http.put<Dossier>(`${this.DOSSIERS_API}/${id}/priority`, null, {
            params: { priorite: priorite.toString() }
        });
    }

    updateStatus(id: string, status: DossierStatus): Observable<Dossier> {
        return this.http.put<Dossier>(`${this.DOSSIERS_API}/${id}/status?status=${status}`, {});
    }

    /** POST /api/scoring/{id}/generate-audit */
    generateAuditReport(id: string): Observable<any> {
        return this.http.post<any>(`/api/scoring/${id}/generate-audit`, {});
    }

    /** POST /api/dossiers/{id}/analyze — Relance manuelle de l'extraction */
    launchAnalysis(id: string): Observable<any> {
        return this.http.post<any>(`${this.DOSSIERS_API}/${id}/analyze`, {});
    }

    /** POST /api/dossiers/batch-analyze — Extraction par lot Phase 1 */
    launchBatchAnalysis(ids: string[]): Observable<any> {
        return this.http.post<any>(`${this.DOSSIERS_API}/batch-analyze`, ids);
    }

    /** GET /api/dossiers/{id}/audit — Historique complet */
    getAuditHistory(id: string): Observable<AuditEntry[]> {
        return this.http.get<AuditEntry[]>(`${this.DOSSIERS_API}/${id}/audit`).pipe(
            catchError(() => of([])) // Mock si l'API n'existe pas encore
        );
    }

    /** GET /api/dossiers/{id}/extraction-p1
     *  Retourne la liste des ExtractionMetadata (12 champs bloquants).
     *  Disponible quand statut = CORRECTION_LOOP.
     */
    getExtractionP1(id: string): Observable<ExtractionMetadata[]> {
        return this.http.get<ExtractionMetadata[]>(`${this.DOSSIERS_API}/${id}/extraction-p1`).pipe(
            catchError(() => of([]))
        );
    }

    /** PUT /api/dossiers/{id}/reextract-field?fieldName=PAYS
     *  Ré-extrait un seul champ via Claude IA (max 2 fois).
     */
    reextractField(id: string, fieldName: string): Observable<ChampResult> {
        return this.http.put<ChampResult>(`${this.DOSSIERS_API}/${id}/reextract-field`, null, {
            params: { fieldName }
        });
    }

    /** PUT /api/dossiers/{id}/validate-p1
     *  Corps : ValidateP1RequestDto { champs: {PAYS: {valeur, humanModified}, ...}, prioriteOverride?, numeroReference?, arriveBo? }
     *  Passe le dossier en statut INDEXED.
     */
    validateP1(id: string, dto: ValidateP1RequestDto): Observable<Dossier> {
        return this.http.put<Dossier>(`${this.DOSSIERS_API}/${id}/validate-p1`, dto);
    }

    /** GET /api/dossiers/{id}/download/{type}
     *  Ex: type = 'apo', 'methodo', 'rapport'
     */
    getDownloadUrl(id: string, type: string): Observable<{ url: string; filename: string; type: string; path: string }> {
        return this.http.get<{ url: string; filename: string; type: string; path: string }>(`${this.DOSSIERS_API}/${id}/download/${type}`);
    }

    /** GET /api/dossiers/{id}/download/{type}/blob
     *  Télécharge le fichier directement via le backend (évite les CORS de MinIO).
     */
    getDownloadBlob(id: string, type: string): Observable<Blob> {
        return this.http.get(`${this.DOSSIERS_API}/${id}/download/${type}/blob`, { responseType: 'blob' });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2 — Analyse approfondie (analyste-service, base: /api/analyses)
    // ═══════════════════════════════════════════════════════════════════════

    /** POST /api/analyses/{id}/deep-analysis
     *  Déclenche l'extraction Phase 2 (16 champs + 10 risques) via Claude.
     *  Répond 202 Accepted — Angular polling sur /api/dossiers/{id}/status.
     */
    triggerDeepAnalysis(id: string): Observable<any> {
        return this.http.post<any>(`/api/analyses/${id}/deep-analysis`, {});
    }

    /** POST /api/analyses/batch-deep-analysis */
    triggerBatchDeepAnalysis(ids: string[]): Observable<any> {
        return this.http.post<any>(`/api/analyses/batch-deep-analysis`, ids);
    }

    /** GET /api/analyses/dashboard-stats — Statistiques agrégées pour le Dashboard */
    getDashboardStats(): Observable<any> {
        return this.http.get<any>('/api/analyses/dashboard-stats').pipe(
            catchError(() => of(null))
        );
    }

    /** GET /api/analyses/{id}/extraction-p2
     *  Retourne l'AnalyseDossier complet (16 champs Phase 2).
     *  Disponible quand statut = DEEP_ANALYSIS ou SCORING.
     */
    getExtractionP2(id: string): Observable<any> {
        return this.http.get<any>(`/api/analyses/${id}/extraction-p2`);
    }

    /** PUT /api/analyses/{id}/validate-p2
     *  Corps : AnalyseDossier partiel avec les corrections de l'analyste.
     *  Champs manuels obligatoires : capaciteDelai, justifCapaciteDelai (si "Non").
     */
    validateP2(id: string, data: any): Observable<any> {
        return this.http.put<any>(`/api/analyses/${id}/validate-p2`, data);
    }

    /** GET /api/analyses/{id}/risks
     *  Retourne les 10 risques décomposés { RISQUE_PAYS_SECURITE: {niveau, justification}, ... }
     */
    getRisks(id: string): Observable<{ [key: string]: { niveau: string; justification: string } }> {
        return this.http.get<any>(`/api/analyses/${id}/risks`);
    }

    /** PUT /api/analyses/{id}/risks/validate
     *  Corps : { PENALITES: {niveau: "Rédhibitoire", justification: "..."}, ... }
     *  ⚠️ Si un niveau = "Rédhibitoire" → P-Win forcé à 0.
     */
    validateRisks(id: string, risques: { [key: string]: { niveau: string; justification: string } }): Observable<any> {
        return this.http.put<any>(`/api/analyses/${id}/risks/validate`, risques);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 3 — Matching (analyste-service, base: /api/matching)
    // ═══════════════════════════════════════════════════════════════════════

    /** POST /api/matching/{id}/run
     *  Lance le matching complet Phase 3.
     */
    runMatching(id: string): Observable<any> {
        return this.http.post<any>(`/api/matching/${id}/run`, {});
    }

    /** POST /api/matching/{id}/recalculate — recalcule SANS appeler Claude */
    recalculateMatching(id: string): Observable<any> {
        return this.http.post<any>(`/api/matching/${id}/recalculate`, {});
    }

    /** GET /api/matching/{id}/result
     *  Retourne le résultat complet (taux de couverture compétences/experts, etc.).
     */
    getMatchingResult(id: string): Observable<any> {
        return this.http.get<any>(`/api/matching/${id}/result`);
    }

    /** GET /api/matching/{id}/matrix
     *  Retourne la matrice de différenciation désérialisée et autres taux/gaps.
     */
    getMatchingMatrix(id: string): Observable<any> {
        return this.http.get<any>(`/api/matching/${id}/matrix`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // APO FORM API — /api/analyst/apo
    // ═══════════════════════════════════════════════════════════════════════

    extractApoForm(projectId: string): Observable<ApoForm> {
        return this.http.post<ApoForm>(`${this.APO_API}/project/${projectId}/extract`, {});
    }

    getApoForm(apoId: string): Observable<ApoForm> {
        return this.http.get<ApoForm>(`${this.APO_API}/${apoId}`);
    }

    saveApoForm(apoId: string, form: ApoForm): Observable<ApoForm> {
        return this.http.put<ApoForm>(`${this.APO_API}/${apoId}`, form);
    }

    exportApoDocx(id: string): Observable<string> {
        // Renvoie l'URL MinIO en string
        return this.http.post(`/api/export/${id}/apo-docx`, {}, { responseType: 'text' });
    }

    exportPackZip(id: string): Observable<string> {
        return this.http.post(`/api/export/${id}/pack-zip`, {}, { responseType: 'text' });
    }

    exportRapportFinal(id: string): Observable<string> {
        return this.http.post(`/api/export/${id}/rapport`, {}, { responseType: 'text' });
    }

    /** GET /api/export/templates/{templateName} */
    getTemplateBlob(templateName: string): Observable<Blob> {
        return this.http.get(`/api/export/templates/${templateName}`, { responseType: 'blob' }).pipe(
            catchError((err) => {
                console.warn(`[AnalystProjectsService] Failed to load ${templateName} from backend. Attempting local fallback...`);
                return this.http.get(`assets/${templateName}`, { responseType: 'blob' });
            })
        );
    }

    exportNoGoReport(id: string): Observable<string> {
        return this.http.post(`/api/export/${id}/nogo-report`, {}, { responseType: 'text' });
    }

    /** PUT /api/apo/{id}/field/{fieldName}
     *  Met à jour un champ spécifique de l'APO
     */
    updateApoField(id: string, fieldName: string, value: string): Observable<any> {
        return this.http.put<any>(`${this.APO_API}/${id}/field/${fieldName}`, value);
    }

    /** POST /api/apo/{id}/assemble
     *  Générer méthodologie
     */
    assembleApo(id: string): Observable<any> {
        return this.http.post<any>(`${this.APO_API}/${id}/assemble`, {});
    }

    /** POST /api/scoring/{id}/confirm-nogo */
    confirmNoGo(id: string): Observable<any> {
        return this.http.post<any>(`/api/scoring/${id}/confirm-nogo`, {});
    }

    /** POST /api/matching/{id}/force-compatible */
    forceCompatible(id: string, justification: string): Observable<any> {
        return this.http.post<any>(`/api/matching/${id}/force-compatible`, { justification });
    }

    /** POST /api/export/{id}/nogo-report */
    generateNoGoReport(id: string, analysteName?: string): Observable<any> {
        const body = analysteName ? { analysteName } : {};
        return this.http.post<any>(`/api/export/${id}/nogo-report`, body);
    }

    /** PUT /api/matching/{id}/matrix/update */
    updateMatchingMatrix(id: string, matrix: any[]): Observable<any> {
        return this.http.put<any>(`/api/matching/${id}/matrix/update`, matrix);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // REFERENTIEL — /api/referentiel
    // ═══════════════════════════════════════════════════════════════════════

    getReferentiel(type: string): Observable<string[]> {
        return this.http.get<string[]>(`${this.REFERENTIEL_API}/${type}`);
    }

    ajouterReferentiel(type: string, valeur: string): Observable<void> {
        return this.http.post<void>(`${this.REFERENTIEL_API}/${type}`, valeur);
    }

    supprimerReferentiel(type: string, valeur: string): Observable<void> {
        return this.http.delete<void>(`${this.REFERENTIEL_API}/${type}/${valeur}`);
    }

    /** GET /api/referentiel/competences — dimension ① compétences sectorielles */
    getReferentielCompetences(): Observable<any[]> {
        return this.http.get<any[]>(`${this.REFERENTIEL_API}/competences`).pipe(catchError(() => of([])));
    }

    /** GET /api/referentiel/references — dimension ② projets passés */
    getReferentielReferences(): Observable<any[]> {
        return this.http.get<any[]>(`${this.REFERENTIEL_API}/references`).pipe(catchError(() => of([])));
    }

    /** GET /api/referentiel/experts — dimension ④ experts mobilisables */
    getReferentielExperts(): Observable<any[]> {
        return this.http.get<any[]>(`${this.REFERENTIEL_API}/experts`).pipe(catchError(() => of([])));
    }

    /** GET /api/referentiel/qualifications — dimension ③ certifications */
    getReferentielQualifications(): Observable<string[]> {
        return this.http.get<string[]>(`${this.REFERENTIEL_API}/qualifications`).pipe(catchError(() => of([])));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LEGACY — Backward compatibility
    // ═══════════════════════════════════════════════════════════════════════

    /** @deprecated Use uploadDossier() instead */
    simulerUpload(titre: string, textPath: string): Observable<string> {
        return this.http.post('/api/dossiers/upload', null, {
            params: { titre, textPath },
            responseType: 'text'
        });
    }

    /** @deprecated Use getExtractionP1() instead */
    getProjectPourValidationInitial(id: string): Observable<any> {
        return this.getExtractionP1(id);
    }

    /** @deprecated No longer needed — backend handles IA callback internally */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    callbackIARecue(_id: string, _result: any): Observable<any> {
        return of({ status: 'SKIPPED', message: 'Backend handles extraction internally' });
    }

    /** @deprecated Use validateP1() instead */
    validerChampsPhase1(id: string, dto: ValidateP1RequestDto): Observable<any> {
        return this.validateP1(id, dto);
    }

    /** @deprecated Use updatePriority() instead */
    modifierPrioriteManuellement(id: string, priorite: number): Observable<any> {
        return this.updatePriority(id, priorite);
    }

    /** @deprecated Use getDossier() instead */
    getProject(id: string): Observable<Dossier> {
        return this.getDossier(id);
    }

    /** @deprecated Use getAllDossiers() — mapped to AnalystProject shape for legacy components */
    listProjects(): Observable<AnalystProject[]> {
        return this.getAllDossiers().pipe(
            map(dossiers => dossiers.map(d => ({
                id: d.id,
                title: d.intituleOffre || d.id,
                description: d.status,
                status: d.status,
                fileName: '',
                createdAt: d.createdAt,
                updatedAt: d.updatedAt
            } as AnalystProject)))
        );
    }

    /** @deprecated Use getExtractionP1() instead */
    getAnalysisResult(id: string): Observable<any> {
        return this.getExtractionP1(id);
    }

    /** @deprecated Téléchargement des fichiers originaux non disponible dans cette version */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    downloadProject(_id: string): Observable<Blob> {
        return throwError(() => new Error('Téléchargement du fichier original non disponible.'));
    }

    /** @deprecated Suppression de dossier non exposée dans cette version */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    deleteProject(_id: string): Observable<void> {
        return throwError(() => new Error('Suppression non disponible.'));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MANAGER NOTIFICATIONS
    // ═══════════════════════════════════════════════════════════════════════

    getManagerPendingNoGo(): Observable<any[]> {
        return this.http.get<any[]>('/api/dossiers/manager/pending-nogo');
    }

    getManagerNotificationCount(): Observable<{count: number}> {
        return this.http.get<{count: number}>('/api/dossiers/manager/notifications/count');
    }

    getAnalystNotificationCount(): Observable<{count: number}> {
        return this.http.get<{count: number}>('/api/dossiers/analyst/notifications/count');
    }

    notifyManager(id: string): Observable<void> {
        return this.http.post<void>(`/api/dossiers/${id}/notify-manager`, {});
    }

    sendToValidators(id: string): Observable<any> {
        return this.http.post<any>(`/api/validation/${id}/send`, {});
    }

    notifyManagerNoGo(id: string): Observable<void> {
        return this.http.post<void>(`/api/dossiers/${id}/notify-manager-nogo`, {});
    }

    getValidationTargets(id: string, type: string = 'GO'): Observable<any[]> {
        return this.http.get<any[]>(`/api/validation/${id}/targets?type=${type}`);
    }

    getGeneratedReportBlobUrl(id: string, type: string): Observable<{url: string, filename: string, type: string, path: string}> {
        return this.http.get<any>(`/api/dossiers/${id}/download/${type}`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // UTILITAIRE
    // ═══════════════════════════════════════════════════════════════════════

    triggerBrowserDownload(blob: Blob, fileName: string): void {
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName || 'document';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);
    }

    getTemplateDocx(templateName: string): Observable<Blob> {
        return this.http.get(`/api/export/templates/${templateName}`, { responseType: 'blob' }).pipe(
            catchError((err) => {
                console.warn(`[AnalystProjectsService] Failed to load ${templateName} from backend. Attempting local fallback...`);
                return this.http.get(`assets/${templateName}`, { responseType: 'blob' });
            })
        );
    }
}
