import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { forkJoin, interval, of, Subscription, Observable } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AnalystProjectsService, Dossier } from '../../../../demo/service/analyst-projects.service';
import { DossierStatusService } from '../../../../demo/service/dossier-status.service';

@Component({
    templateUrl: './analyst-dossiers.component.html',
    styleUrls: ['./analyst-dossiers.component.scss'],
    providers: [MessageService]
})
export class AnalystDossiersComponent implements OnInit, OnDestroy {

    dossiers: Dossier[] = [];
    isLoading = false;
    searchTerm = '';

    stats = { urgent: 0, enAnalyse: 0, enValidation: 0, total: 0 };

    // --- BATCH PROCESSING STATE ---
    selectedDossiers: Dossier[] = [];
    isBatchProcessing = false;
    batchStatusModalVisible = false;
    batchActionTitle = '';
    batchProgress: { [id: string]: { status: string, progress: number, completed: boolean, error?: boolean } } = {};
    currentBatchAction = '';
    private batchPollingSub?: Subscription;
    // ------------------------------

    private refreshSub?: Subscription;

    constructor(
        private projectsService: AnalystProjectsService,
        private statusService: DossierStatusService,
        private router: Router,
        private messageService: MessageService
    ) {}

    ngOnInit(): void {
        this.loadDossiers();
        // Polling 30s sur statuts asynchrones (spec)
        this.refreshSub = interval(30000).pipe(
            switchMap(() => this.projectsService.getAllDossiers())
        ).subscribe({
            next: (data) => this.applyDossiers(data),
            error: () => { /* silent */ }
        });
    }

    ngOnDestroy(): void {
        this.refreshSub?.unsubscribe();
        this.batchPollingSub?.unsubscribe();
    }

    loadDossiers(): void {
        this.isLoading = true;
        this.projectsService.getAllDossiers().subscribe({
            next: (data) => {
                this.applyDossiers(data);
                this.isLoading = false;
            },
            error: () => {
                this.dossiers = [];
                this.isLoading = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur',
                    detail: 'GET /api/dossiers indisponible.'
                });
            }
        });
    }

    private applyDossiers(data: Dossier[]): void {
        // Étape 1 — Tri dynamique (miroir de DossierRepository.findAllOrderByPrioriteAndDate)
        this.dossiers = Array.isArray(data) ? data.sort((a, b) => {
            // Priorité ASC (1 = urgent en haut)
            const pA = a.priorite ?? 99;
            const pB = b.priorite ?? 99;
            if (pA !== pB) return pA - pB;
            // Date limite ASC (le plus proche en premier)
            const dA = a.dtLimSoum ? new Date(a.dtLimSoum).getTime() : Infinity;
            const dB = b.dtLimSoum ? new Date(b.dtLimSoum).getTime() : Infinity;
            return dA - dB;
        }) : [];
        this.computeStats();
    }

    private computeStats(): void {
        const t = this.dossiers.length;
        const u = this.dossiers.filter(d => (d.joursOuvrables ?? 99) < 10).length;
        const eA = this.dossiers.filter(d =>
            ['PARSING_INITIAL', 'DEEP_ANALYSIS', 'SCORING', 'MATCHING'].includes(d.status)
        ).length;
        const eV = this.dossiers.filter(d =>
            ['CORRECTION_LOOP', 'PENDING_VALIDATION'].includes(d.status)
        ).length;

        this.animateValue('total', t, 1000);
        this.animateValue('urgent', u, 1200);
        this.animateValue('enAnalyse', eA, 1400);
        this.animateValue('enValidation', eV, 1600);
    }

    private animateValue(prop: 'total'|'urgent'|'enAnalyse'|'enValidation', end: number, duration: number): void {
        let start = 0;
        const stepTime = Math.abs(Math.floor(duration / (end || 1)));
        const timer = setInterval(() => {
            start += 1;
            this.stats[prop] = start;
            if (start >= end) {
                this.stats[prop] = end;
                clearInterval(timer);
            }
        }, stepTime < 16 ? 16 : stepTime);
    }

    exportPdf(): void {
        import('jspdf').then((jsPDF) => {
            import('jspdf-autotable').then((x) => {
                const doc = new jsPDF.default('l', 'pt', 'a4');
                const exportColumns = [
                    { title: 'Priorité', dataKey: 'priorite' },
                    { title: 'Intitulé de l\'offre', dataKey: 'intituleOffre' },
                    { title: 'Client', dataKey: 'client' },
                    { title: 'Phase Actuelle', dataKey: 'status' }
                ];
                (doc as any).autoTable({
                    columns: exportColumns,
                    body: this.dossiers,
                    theme: 'grid',
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [41, 128, 185] }
                });
                doc.save('Dossiers_Importes.pdf');
            });
        });
    }

    get filtered(): Dossier[] {
        const term = this.searchTerm.trim().toLowerCase();
        let list = [...this.dossiers];
        if (term) {
            list = list.filter(d =>
                (d.intituleOffre || '').toLowerCase().includes(term) ||
                (d.client || '').toLowerCase().includes(term) ||
                (d.pays || '').toLowerCase().includes(term)
            );
        }
        return list.sort((a, b) => (a.priorite ?? 3) - (b.priorite ?? 3));
    }

    openDossier(d: Dossier): void {
        localStorage.setItem('lastProjectId', d.id);
        this.router.navigate(this.statusService.resolveRoute(d));
    }

    newDossier(): void {
        this.router.navigate(['/dossiers/nouveau']);
    }

    retryAnalysis(d: Dossier): void {
        this.messageService.add({severity: 'info', summary: 'Relance', detail: 'Relance de l\'analyse en cours...'});
        this.projectsService.launchAnalysis(d.id).subscribe({
            next: () => {
                this.messageService.add({severity: 'success', summary: 'Succès', detail: 'Analyse relancée.'});
                this.loadDossiers();
            },
            error: () => {
                this.messageService.add({severity: 'error', summary: 'Erreur', detail: 'Impossible de relancer l\'analyse.'});
            }
        });
    }

    statusLabel(status: string): string {
        return this.statusService.statusLabel(status);
    }

    statusSeverity(status: string): 'success' | 'warning' | 'info' | 'danger' | 'secondary' {
        return this.statusService.statusSeverity(status);
    }

    formatDate(d?: string): string {
        if (!d) return '—';
        try {
            return new Date(d).toLocaleDateString('fr-FR');
        } catch {
            return d;
        }
    }

    joursLabel(d: Dossier): string {
        const j = d.joursOuvrables;
        if (j == null) return '';
        return j <= 10 ? `${this.formatDate(d.dtLimSoum)} · J-${j}⚠` : `${this.formatDate(d.dtLimSoum)} · J-${j}`;
    }

    pwinDisplay(d: Dossier): string {
        if (d.pwinScore == null) return '—';
        return `${Math.round(d.pwinScore)}%`;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // BATCH PROCESSING (Option B)
    // ═══════════════════════════════════════════════════════════════════════

    get availableBatchAction(): string | null {
        if (!this.selectedDossiers || this.selectedDossiers.length === 0) return null;
        
        // Tous les dossiers doivent avoir le même statut pour lancer une action en lot
        const firstStatus = this.selectedDossiers[0].status;
        const allSameStatus = this.selectedDossiers.every(d => d.status === firstStatus);
        
        if (!allSameStatus) return null;
        
        if (firstStatus === 'INDEXED') return 'START_PHASE_2';
        if (firstStatus === 'DEEP_ANALYSIS') return 'RESUME_PHASE_2';
        if (firstStatus === 'PARSING_INITIAL') return 'START_PHASE_1';
        
        return null; // Plus d'actions de lot peuvent être ajoutées ici
    }

    get availableBatchActionLabel(): string {
        const action = this.availableBatchAction;
        const count = this.selectedDossiers.length;
        if (action === 'START_PHASE_2' || action === 'RESUME_PHASE_2') return `⚡ Lancer Phase 2 pour ${count} dossier(s)`;
        if (action === 'START_PHASE_1') return `⚡ Lancer Extraction pour ${count} dossier(s)`;
        return '';
    }

    executeBatchAction(): void {
        const action = this.availableBatchAction;
        if (!action) return;
        
        this.isBatchProcessing = true;
        this.batchStatusModalVisible = true;
        this.batchActionTitle = this.availableBatchActionLabel;
        this.currentBatchAction = action;
        
        // Initialiser l'état de progression pour chaque dossier sélectionné
        this.batchProgress = {};
        this.selectedDossiers.forEach(d => {
            this.batchProgress[d.id] = { status: 'INITIALISATION...', progress: 10, completed: false, error: false };
        });
        
        let observables: Observable<any>[] = [];
        
        if (action === 'START_PHASE_2' || action === 'RESUME_PHASE_2') {
            observables = this.selectedDossiers.map(d => {
                return this.projectsService.triggerDeepAnalysis(d.id).pipe(
                    catchError(err => of({ error: true, id: d.id }))
                );
            });
        } else if (action === 'START_PHASE_1') {
            observables = this.selectedDossiers.map(d => {
                return this.projectsService.launchAnalysis(d.id).pipe(
                    catchError(err => of({ error: true, id: d.id }))
                );
            });
        } else {
             this.messageService.add({severity: 'info', summary: 'Info', detail: 'Action en lot non encore implémentée pour ce statut.'});
             this.batchStatusModalVisible = false;
             this.isBatchProcessing = false;
             return;
        }

        // Lancer les requêtes en parallèle au backend
        forkJoin(observables).subscribe(results => {
            // Vérifier s'il y a eu des erreurs d'initialisation
            results.forEach((res: any, index) => {
                if (res && res.error) {
                     const d = this.selectedDossiers[index];
                     this.batchProgress[d.id].error = true;
                     this.batchProgress[d.id].status = 'ERREUR API';
                }
            });
            // Démarrer le polling pour mettre à jour les statuts en temps réel
            this.startBatchPolling();
        });
    }

    startBatchPolling(): void {
       // Interroger le backend toutes les 3 secondes pour rafraîchir les statuts
       this.batchPollingSub = interval(3000).pipe(
           switchMap(() => this.projectsService.getAllDossiers())
       ).subscribe(dossiersList => {
           let allCompleted = true;
           let hasErrors = false;
           
           this.selectedDossiers.forEach(selected => {
               const state = this.batchProgress[selected.id];
               if (state.error) hasErrors = true;
               if (state.error || state.completed) return; // Ignorer ceux finis ou en erreur
               
               const currentDossier = dossiersList.find(d => d.id === selected.id);
               if (currentDossier) {
                   state.status = this.statusLabel(currentDossier.status);
                                      // Logique de progression basée sur le statut
                    if (this.currentBatchAction === 'START_PHASE_1') {
                        if (currentDossier.status === 'PARSING_INITIAL') {
                            state.progress = 50;
                            allCompleted = false;
                        } else if (currentDossier.status === 'CORRECTION_LOOP' || currentDossier.status === 'INDEXED') {
                            state.progress = 100;
                            state.completed = true;
                        } else {
                            state.progress = 25;
                            allCompleted = false;
                        }
                    } else {
                        // START_PHASE_2 ou RESUME_PHASE_2
                        if (currentDossier.status === 'DEEP_ANALYSIS') {
                            state.progress = 50;
                            allCompleted = false;
                        } else if (currentDossier.status === 'SCORING' || currentDossier.status === 'PENDING_VALIDATION' || currentDossier.status === 'NO_GO_CONFIRMED' || currentDossier.status === 'MATCHING') {
                            state.progress = 100;
                            state.completed = true;
                        } else {
                            state.progress = 25;
                            allCompleted = false;
                        }
                    }
                   
                   // Mettre à jour la liste principale en arrière-plan
                   const index = this.dossiers.findIndex(d => d.id === currentDossier.id);
                   if (index !== -1) {
                       this.dossiers[index] = currentDossier;
                   }
               } else {
                   allCompleted = false;
               }
           });
           
           if (allCompleted) {
               this.isBatchProcessing = false;
               this.batchPollingSub?.unsubscribe();
               if (hasErrors) {
                   this.messageService.add({severity: 'error', summary: 'Terminé avec erreurs', detail: 'Le traitement est terminé, mais certaines API ont échoué.'});
               } else {
                   this.messageService.add({severity: 'success', summary: 'Terminé', detail: 'Le traitement par lot est terminé avec succès !'});
               }
               // Rafraîchir la liste complète et vider la sélection
               this.loadDossiers();
           }
       });
    }

    closeBatchModal(): void {
        this.batchStatusModalVisible = false;
        // Laisser le polling tourner en arrière-plan si ce n'est pas fini
    }

    // Utilisé dans le HTML pour itérer sur les clés du dictionnaire de progression
    getObjectKeys(obj: any): string[] {
        return Object.keys(obj);
    }
}
