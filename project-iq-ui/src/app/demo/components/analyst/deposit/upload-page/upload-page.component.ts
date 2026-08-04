import { Component, OnDestroy, ViewChild, OnInit } from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { Router } from '@angular/router';
import { MessageService, MenuItem } from 'primeng/api';
import { Table } from 'primeng/table';
import { Subscription } from 'rxjs';
import { AnalystProjectsService, Dossier, DossierStatus } from '../../../../service/analyst-projects.service';
import { DossierStatusService, PHASE1_PIPELINE } from '../../../../service/dossier-status.service';
import { PromptOverrideComponent } from '../../shared/prompt-override/prompt-override.component';
import { NotificationStateService } from '../../../../service/notification-state.service';
import { PipelineEvent } from '../../../../../services/sse.service';
import { PipelineTrackingService } from '../../../../service/pipeline-tracking.service';

@Component({
    selector: 'app-upload-page',
    templateUrl: './upload-page.component.html',
    styleUrls: ['./upload-page.component.scss'],
    providers: [MessageService]
})
export class UploadPageComponent implements OnInit, OnDestroy {

    @ViewChild('dt') dt!: Table;
    @ViewChild('promptDrawer') promptDrawer!: PromptOverrideComponent;

    exportMenuItems: MenuItem[] = [];
    selectedDossierIdForPrompt: string = '';

    fileAP: File | null = null;
    fileTDR: File | null = null;
    dragOverAP = false;
    dragOverTDR = false;

    // Métadonnées
    dateLimite: Date | null = null;
    intitule = '';
    today = new Date();

    analyzingDossierId: string | null = null;
    isUploading = false;
    uploadProgress = 0;
    currentStatus: DossierStatus | '' = '';
    dossierId: string | null = null;
    isPrivate: boolean = false;

    phase1Pipeline = PHASE1_PIPELINE;

    currentIndex = -1;

    // Pipeline 4 étapes pour navigation
    pipelineSteps = [
        { status: 'UPLOADED', label: 'Dépôt' },
        { status: 'PARSING_INITIAL', label: 'Extraction IA' },
        { status: 'CORRECTION_LOOP', label: 'Validation' },
        { status: 'INDEXED', label: 'Indexation' }
    ];

    isFileUploading = false;
    fileUploaded = false;
    fileUploadProgress = 0;

    // Dashboard: loaded from backend
    loadedDossiers: Dossier[] = [];
    useTestMode = false; // Branché au backend réel

    // MODE TEST - Dossiers AO list (Dossier interface format)
    testDossiers: Dossier[] = [
        { id: '1', intituleOffre: 'AO - Réhabilitation Station Épuration', client: 'ONEE - Branche Eau', pays: 'Maroc', dtLimSoum: '2026-09-15', status: 'UPLOADED', priorite: 3, joursOuvrables: 55 },
        { id: '2', intituleOffre: 'AO - Construction Stade Tanger', client: 'Ministère Sports', pays: 'Maroc', dtLimSoum: '2026-07-05', status: 'UPLOADED', priorite: 1, joursOuvrables: 6 },
        { id: '3', intituleOffre: 'AO - Réhabilitation Réseau Eau', client: 'ONEE', pays: 'Maroc', dtLimSoum: '2026-07-15', status: 'PARSING_INITIAL', priorite: 2, joursOuvrables: 14 },
        { id: '4', intituleOffre: 'AO - Centre Hospitalier Rabat', client: 'MS', pays: 'Maroc', dtLimSoum: '2026-09-25', status: 'UPLOADED', priorite: 3, joursOuvrables: 62 },
        { id: '5', intituleOffre: 'AO - Tramway Casablanca', client: 'Casa Transport', pays: 'Maroc', dtLimSoum: '2026-07-02', status: 'UPLOADED', priorite: 1, joursOuvrables: 3 },
        { id: '6', intituleOffre: 'AO - Barrage Oued Rmel', client: 'Ministère Équipement', pays: 'Tunisie', dtLimSoum: '2026-07-20', status: 'CORRECTION_LOOP', priorite: 2, joursOuvrables: 17 }
    ];

    // Pagination
    rows = 5;
    rowsPerPageOptions = [5, 10, 25];

    // Search
    searchValue = '';

    private pollSub?: Subscription;

    constructor(
        private projectsService: AnalystProjectsService,
        private statusService: DossierStatusService,
        private messageService: MessageService,
        private router: Router,
        public notificationState: NotificationStateService,
        private pipelineTrackingService: PipelineTrackingService
    ) { }

    ngOnInit(): void {
        if (!this.useTestMode) {
            this.loadDossiers();
        }

        this.exportMenuItems = [
            {
                label: 'Exporter en CSV',
                icon: 'pi pi-file',
                command: () => {
                    this.exportCSV();
                }
            },
            {
                label: 'Exporter en PDF',
                icon: 'pi pi-file-pdf',
                command: () => {
                    this.exportPDF();
                }
            }
        ];
    }

    private loadDossiers(): void {
        this.projectsService.getAllDossiers().subscribe({
            next: (dossiers) => {
                console.log('Dossiers from backend:', dossiers);
                dossiers.forEach(d => {
                    console.log(`  - id: "${d.id}", status: "${d.status}", intitule: "${d.intituleOffre}"`);
                });
                this.loadedDossiers = dossiers;
            },
            error: (err) => { console.error('Error:', err); }
        });
    }

    get dashboardDossiers(): Dossier[] {
        if (this.useTestMode) return this.testDossiers;
        return this.loadedDossiers;
    }

    /** Dossiers triés par priorité ASC puis date limite ASC */
    get sortedDossiers(): Dossier[] {
        return [...this.dashboardDossiers].sort((a, b) => {
            const pA = this.getDossierPriorite(a);
            const pB = this.getDossierPriorite(b);
            if (pA !== pB) return pA - pB;
            const dateA = a.dtLimSoum ? new Date(a.dtLimSoum).getTime() : Infinity;
            const dateB = b.dtLimSoum ? new Date(b.dtLimSoum).getTime() : Infinity;
            return dateA - dateB;
        });
    }

    get stats() {
        const dossiers = this.dashboardDossiers;
        const urgent = dossiers.filter(d => this.getDossierPriorite(d) === 1).length;
        const modere = dossiers.filter(d => this.getDossierPriorite(d) === 2).length;
        const normal = dossiers.filter(d => this.getDossierPriorite(d) === 3).length;
        const total = dossiers.length;
        return { urgent, modere, normal, total };
    }

    ngOnDestroy(): void {
        this.pollSub?.unsubscribe();
    }

    get canAnalyze(): boolean {
        return this.fileUploaded && !!this.fileTDR && !!this.dateLimite && !this.isUploading;
    }

    get pipelineProgress(): number {
        if (this.currentIndex < 0) return 0;
        return ((this.currentIndex + 1) / 4) * 100;
    }

    get daysRemaining(): number {
        if (!this.dateLimite) return 0;
        const dl = this.dateLimite;
        const diff = dl.getTime() - this.today.getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    get analyzeTooltip(): string {
        if (!this.fileTDR) return 'TDR manquant — déposez les Termes de Référence';
        if (!this.dateLimite) return 'Date limite de soumission requise';
        if (this.isUploading) return 'Analyse en cours…';
        return '';
    }

    // ══════════════════════════════════════════════════════
    /** Calcule la priorité exacte (1, 2, 3) en se basant sur les jours ouvrables restants, comme le backend */
    getDossierPriorite(dossier: Dossier): number {
        if (dossier.priorityOverride && dossier.priorite) {
            return dossier.priorite;
        }
        if (dossier.dtLimSoum) {
            const jours = this.getDaysRemainingFromDate(dossier.dtLimSoum);
            if (jours <= 10) return 1;
            if (jours <= 20) return 2;
            return 3;
        }
        return dossier.priorite || 3;
    }

    getPriorityLabel(priorite: number | undefined): string {
        switch (priorite) {
            case 1: return 'Urgent';
            case 2: return 'Modéré';
            case 3: return 'Normal';
            default: return 'Normal';
        }
    }

    getPrioritySeverity(priorite: number | undefined): 'danger' | 'warning' | 'success' {
        switch (priorite) {
            case 1: return 'danger';
            case 2: return 'warning';
            case 3: return 'success';
            default: return 'success';
        }
    }

    getPriorityClass(priorite: number | undefined): string {
        switch (priorite) {
            case 1: return 'priority-urgent';
            case 2: return 'priority-moderate';
            case 3: return 'priority-normal';
            default: return 'priority-normal';
        }
    }

    getDaysRemainingFromDate(dtLimSoum: string | undefined): number {
        if (!dtLimSoum) return 999;
        const dl = new Date(dtLimSoum);
        const now = new Date();
        return Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    getDaysRemainingClass(days: number): string {
        if (days <= 10) return 'days-critical';
        if (days <= 20) return 'days-warning';
        return 'days-ok';
    }

    // ══════════════════════════════════════════════════════
    // Table actions
    // ══════════════════════════════════════════════════════

    onGlobalFilter(event: Event): void {
        const value = (event.target as HTMLInputElement).value;
        this.dt?.filterGlobal(value, 'contains');
    }

    clearSearch(): void {
        this.searchValue = '';
        this.dt?.filterGlobal('', 'contains');
    }

    /** Passer un dossier à l'analyse — appelle POST /api/dossiers/{id}/analyze */
    launchAnalysis(dossier: Dossier): void {
        if (!dossier.id) return;
        this.dossierId = dossier.id; // Stocker l'ID pour le polling global
        this.analyzingDossierId = dossier.id;

        // Mise à jour optimiste de l'UI
        dossier.status = 'PARSING_INITIAL';

        // Déléguer le suivi global à notre nouveau service
        this.pipelineTrackingService.startTracking(dossier.id!, dossier.intituleOffre || '');

        this.projectsService.launchAnalysis(dossier.id).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Analyse lancée',
                    detail: `Le dossier "${dossier.intituleOffre || dossier.id}" est en cours de traitement IA.`
                });
                this.loadDossiers();

                // Démarrer le polling pour surveiller la fin de l'extraction
                this.startPolling(dossier.id!);
            },
            error: (err) => {
                this.cancelAnalysis();
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur',
                    detail: err?.error?.message || 'Impossible de lancer l\'analyse pour ce dossier.'
                });
            }
        });
    }

    /** Permet à l'analyste d'annuler manuellement l'interface d'attente (sans tuer le processus serveur) */
    cancelAnalysis(): void {
        this.pipelineTrackingService.stopTracking();
        this.isUploading = false;
        this.analyzingDossierId = null;
        
        // Se déconnecter des flux
        this.pollSub?.unsubscribe();
        
        // Recharger le tableau
        this.loadDossiers();
    }

    canLaunchAnalysis(dossier: Dossier): boolean {
        return dossier.status === 'UPLOADED' || dossier.status === 'PARSING_INITIAL' || dossier.status === 'INDEXED' || dossier.status === 'ERROR';
    }

    openPromptConfig(id: string | null): void {
        if (!id) return;
        this.selectedDossierIdForPrompt = id;
        setTimeout(() => {
            this.promptDrawer.showDialog();
        }, 0);
    }

    /** Export table data as CSV */
    exportCSV(): void {
        const dossiers = this.sortedDossiers;
        if (dossiers.length === 0) {
            this.messageService.add({ severity: 'warn', summary: 'Export', detail: 'Aucun dossier à exporter.' });
            return;
        }

        const headers = ['ID', 'Intitulé', 'Date Limite', 'Jours Restants', 'Priorité', 'Statut'];
        const rows = dossiers.map(d => [
            this.shortId(d.id),
            d.intituleOffre || '-',
            d.dtLimSoum || '-',
            this.getDaysRemainingFromDate(d.dtLimSoum).toString(),
            this.getPriorityLabel(this.getDossierPriorite(d)),
            this.statusLabel(d.status || '')
        ]);

        let csv = '\uFEFF'; // BOM for Excel UTF-8
        csv += headers.join(';') + '\n';
        rows.forEach(row => { csv += row.join(';') + '\n'; });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dossiers_depot_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.messageService.add({ severity: 'success', summary: 'Export CSV', detail: `${dossiers.length} dossier(s) exporté(s).` });
    }

    /** Export table as PDF via jsPDF + autoTable */
    exportPDF(): void {
        import('jspdf').then(jsPDFModule => {
            import('jspdf-autotable').then(() => {
                const doc = new jsPDFModule.default('l', 'mm', 'a4');
                const dossiers = this.sortedDossiers;

                doc.setFontSize(16);
                doc.text('Dossiers Dépôt — Rapport de Priorité', 14, 20);
                doc.setFontSize(10);
                doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 14, 28);

                const body = dossiers.map(d => [
                    this.shortId(d.id),
                    d.intituleOffre || '-',
                    d.dtLimSoum || '-',
                    this.getDaysRemainingFromDate(d.dtLimSoum).toString() + 'j',
                    this.getPriorityLabel(this.getDossierPriorite(d)),
                    this.statusLabel(d.status || '')
                ]);

                (doc as any).autoTable({
                    startY: 34,
                    head: [['ID', 'Intitulé', 'Date Limite', 'Jours', 'Priorité', 'Statut']],
                    body: body,
                    styles: { fontSize: 8, cellPadding: 3 },
                    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
                    alternateRowStyles: { fillColor: [248, 250, 252] },
                    columnStyles: {
                        4: { fontStyle: 'bold' }
                    }
                });

                doc.save(`dossiers_depot_${new Date().toISOString().slice(0, 10)}.pdf`);
                this.messageService.add({ severity: 'success', summary: 'Export PDF', detail: `${dossiers.length} dossier(s) exporté(s).` });
            });
        });
    }

    // ══════════════════════════════════════════════════════
    // Drag & Drop + File handling (INCHANGÉ)
    // ══════════════════════════════════════════════════════

    onDragOver(e: DragEvent, type: 'AP' | 'TDR'): void {
        e.preventDefault();
        if (type === 'AP') this.dragOverAP = true;
        else this.dragOverTDR = true;
    }

    onDragLeave(e: DragEvent, type: 'AP' | 'TDR'): void {
        e.preventDefault();
        if (type === 'AP') this.dragOverAP = false;
        else this.dragOverTDR = false;
    }

    onDrop(e: DragEvent, type: 'AP' | 'TDR'): void {
        e.preventDefault();
        if (type === 'AP') this.dragOverAP = false;
        else this.dragOverTDR = false;
        const file = e.dataTransfer?.files?.[0];
        if (file) this.setFile(file, type);
    }

    onFileSelect(e: Event, type: 'AP' | 'TDR'): void {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (file) this.setFile(file, type);
        input.value = '';
    }

    private setFile(file: File, type: 'AP' | 'TDR'): void {
        const ok = /\.(pdf|docx?)$/i.test(file.name);
        if (!ok) {
            this.messageService.add({
                severity: 'error',
                summary: 'Format invalide',
                detail: 'PDF ou DOCX uniquement.'
            });
            return;
        }
        if (file.size > 100 * 1024 * 1024) {
            this.messageService.add({
                severity: 'error',
                summary: 'Fichier trop volumineux',
                detail: 'La taille maximale autorisée est de 100 Mo.'
            });
            return;
        }
        if (type === 'AP') {
            this.fileAP = file;
        } else {
            this.fileTDR = file;
            // Use the file name (without extension) as the default intitule
            this.intitule = file.name.replace(/\.[^/.]+$/, "");
            // Pas de simulation — l'upload réel se déclenche via le bouton "Télécharger"
        }
    }

    clearFile(type: 'AP' | 'TDR'): void {
        if (type === 'AP') {
            this.fileAP = null;
        } else {
            this.fileTDR = null;
            this.fileUploaded = false;
            this.fileUploadProgress = 0;
            this.currentIndex = -1;
            this.currentStatus = '';
        }
    }

    formatSize(bytes: number): string {
        if (!bytes) return '';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${['o', 'Ko', 'Mo'][i]}`;
    }

    cancel(): void {
        this.pollSub?.unsubscribe();
        this.isUploading = false;
        this.uploadProgress = 0;
        this.currentStatus = '';
        this.dossierId = null;
        this.fileUploaded = false;
        this.fileUploadProgress = 0;
        this.currentIndex = -1;
        this.isPrivate = false;
    }

    /** Bouton "Télécharger" — Upload le fichier vers le backend */
    upload(): void {
        console.log('upload clicked', this.fileTDR, this.dateLimite);
        if (!this.fileTDR || !this.dateLimite) { alert('Veuillez sélectionner un fichier et une date'); return; }
        this.isFileUploading = true;
        this.fileUploadProgress = 0;
        this.currentIndex = 0;

        let dateLimiteStr = '';
        try {
            // Conversion robuste Date -> YYYY-MM-DD (gère si c'est déjà une string ou un objet Date)
            let dl: Date;
            if (typeof this.dateLimite === 'string') {
                dl = new Date(this.dateLimite);
            } else {
                dl = this.dateLimite;
            }

            dateLimiteStr = dl.getFullYear() + '-' +
                String(dl.getMonth() + 1).padStart(2, '0') + '-' +
                String(dl.getDate()).padStart(2, '0');
        } catch (e) {
            console.error("Erreur de parsing de la date", e);
            dateLimiteStr = new Date().toISOString().split('T')[0];
        }

        console.log("Envoi au backend avec dateLimiteStr = ", dateLimiteStr);

        this.projectsService.uploadDossier(this.fileTDR, dateLimiteStr, this.intitule, this.isPrivate).subscribe({
            next: (event: any) => {
                if (event.type === HttpEventType.UploadProgress) {
                    if (event.total) {
                        this.fileUploadProgress = Math.round(100 * event.loaded / event.total);
                    }
                } else if (event.type === HttpEventType.Response) {
                    const dossier = event.body;
                    this.dossierId = dossier.id;
                    localStorage.setItem('lastProjectId', dossier.id);
                    this.fileUploaded = true;
                    this.isFileUploading = false;
                    this.fileUploadProgress = 100;
                    this.currentStatus = 'UPLOADED';
                    this.currentIndex = 0;
                    // Recharger la liste depuis le back pour avoir les vraie données
                    this.loadDossiers();

                    // L'analyse n'est plus lancée automatiquement.
                    // L'utilisateur doit cliquer sur "Analyser" dans le tableau.
                }
            },
            error: (err) => {
                this.isFileUploading = false;
                this.fileUploadProgress = 0;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur upload',
                    detail: err?.error?.message || 'POST /api/dossiers/upload a échoué.'
                });
            }
        });
    }

    /** Lance l'analyse IA — appelle POST /api/dossiers/{id}/analyze et commence le polling */
    analyze(): void {
        if (!this.dossierId || !this.canAnalyze) return;

        this.isUploading = true;
        this.uploadProgress = 10;
        this.currentIndex = 1;
        this.currentStatus = 'PARSING_INITIAL';

        this.projectsService.launchAnalysis(this.dossierId).subscribe({
            next: () => {
                // Démarrer le polling
                this.startPolling(this.dossierId!);
            },
            error: (err) => {
                this.isUploading = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur',
                    detail: err?.error?.message || 'Impossible de lancer l\'analyse IA.'
                });
            }
        });
    }

    private startPolling(dossierId: string): void {
        this.pollSub?.unsubscribe();

        this.pollSub = this.statusService.watchUploadPipeline(dossierId, (resp) => {
            this.currentStatus = resp.status;
            if (resp.status === 'UPLOADED') { this.uploadProgress = 40; this.currentIndex = 0; }
            else if (resp.status === 'PARSING_INITIAL') { this.uploadProgress = 67; this.currentIndex = 1; }
            else if (resp.status === 'CORRECTION_LOOP') { this.uploadProgress = 85; this.currentIndex = 2; }
            else if (resp.status === 'INDEXED') { this.uploadProgress = 100; this.currentIndex = 3; }

            // Reload the table so the row updates the status
            if (this.analyzingDossierId === dossierId) {
                this.loadDossiers();
            }
        }).subscribe({
            next: (resp) => {
                if (resp.status === 'ERROR') {
                    this.isUploading = false;
                    this.analyzingDossierId = null;
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Échec de l\'analyse',
                        detail: 'Erreur inattendue de l\'IA. Veuillez réessayer.'
                    });
                    this.pollSub?.unsubscribe();
                    this.loadDossiers();
                } else if (resp.status === 'CORRECTION_LOOP' || resp.status === 'INDEXED') {
                    // La phase 1 est terminée (le backend est passé à la phase 2 en arrière-plan)
                    this.isUploading = false;
                    this.analyzingDossierId = null; 
                    
                    // On met à jour l'état visuel du polling principal
                    this.pollSub?.unsubscribe();
                    this.loadDossiers();
                }
            },
            error: () => {
                this.isUploading = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Polling interrompu',
                    detail: 'Impossible de suivre le statut du dossier.'
                });
            }
        });
    }

    phase1Index(): number {
        if (!this.currentStatus) return -1;
        return this.phase1Pipeline.indexOf(this.currentStatus);
    }

    statusLabel(s: string): string {
        return this.statusService.statusLabel(s);
    }

    goToStep(index: number): void {
        if (index > this.currentIndex) return;
        const step = this.pipelineSteps[index];
        if (!step) return;
        this.messageService.add({ severity: 'info', summary: 'Navigation', detail: 'Étape: ' + step.label });
        if (index >= 2 && this.dossierId) this.router.navigate(['/dossiers', this.dossierId, 'validation-p1']);
    }

    goToPipelineStep(index: number, status: string): void {
        if (!this.dossierId) return;
        if (status === 'INDEXED' || status === 'CORRECTION_LOOP') {
            this.router.navigate(['/dossiers', this.dossierId, 'validation-p1']);
        } else {
            this.messageService.add({ severity: 'info', summary: 'Info', detail: 'Étape actuelle: ' + this.statusLabel(status) });
        }
    }

    viewDossier(id: string): void {
        this.router.navigate(['/dossiers', id, 'extraction']);
    }

    analyzeDossier(id: string): void {
        if (!id) return;
        this.dossierId = id;
        this.messageService.add({ severity: 'info', summary: 'Analyse', detail: 'Lancement de l\'analyse pour ' + id });
        this.router.navigate(['/dossiers', id, 'validation-p1']);
    }

    goToValidation(dossier: Dossier | null): void {
        if (dossier) {
            this.statusService.navigateForStatus(dossier);
        }
    }

    shortId(id: string): string {
        if (!id) return '';
        return id.length > 8 ? id.substring(0, 8) + '…' : id;
    }

    getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | undefined {
        if (status === 'UPLOADED') return 'info';
        if (status === 'PARSING_INITIAL') return 'warn';
        if (status === 'CORRECTION_LOOP') return 'warn';
        if (status === 'INDEXED') return 'success';
        return undefined;
    }

    getStatusIcon(status: string): string {
        switch (status) {
            case 'UPLOADED': return 'pi pi-cloud-upload';
            case 'PARSING_INITIAL': return 'pi pi-spin pi-cog';
            case 'CORRECTION_LOOP': return 'pi pi-pencil';
            case 'INDEXED': return 'pi pi-check-circle';
            default: return 'pi pi-circle';
        }
    }
}