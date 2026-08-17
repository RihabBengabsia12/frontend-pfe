import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SseService, PipelineEvent } from '../../services/sse.service';
import { NotificationStateService } from './notification-state.service';
import { Router } from '@angular/router';

export interface PipelineState {
    activeDossierId: string | null;
    dossierTitle: string;
    progress: number;
    statusLabel: string;
    hasError: boolean;
    isModalVisible: boolean;
    isCompleted?: boolean;
    completedType?: 'success' | 'warning' | 'error' | null;
}

@Injectable({ providedIn: 'root' })
export class PipelineTrackingService {
    private stateSubj = new BehaviorSubject<PipelineState>({
        activeDossierId: null,
        dossierTitle: '',
        progress: 0,
        statusLabel: '',
        hasError: false,
        isModalVisible: false
    });
    state$ = this.stateSubj.asObservable();
    
    private sseSub: any = null;
    private phase1Interval: any = null;

    constructor(
        private sseService: SseService,
        private notificationService: NotificationStateService,
        private router: Router
    ) {}

    startTracking(dossierId: string, title: string) {
        this.stopTracking();
        
        this.stateSubj.next({
            activeDossierId: dossierId,
            dossierTitle: title || 'Nouveau Dossier',
            progress: 5,
            statusLabel: 'Phase 1 : Extraction des critères par l\'IA (Patientez, environ 15-30s)...',
            hasError: false,
            isModalVisible: false // On attend que l'utilisateur clique sur la cloche
        });

        // Simuler la progression jusqu'à 25% (Phase 1)
        this.clearPhase1Interval();
        this.phase1Interval = setInterval(() => {
            const current = this.stateSubj.getValue();
            if (current.progress < 25 && !current.hasError) {
                this.updateState({ progress: current.progress + 1 });
            }
        }, 1500);

        // Notification silencieuse — pas dans la cloche
        this.notificationService.addNotification({
            title: 'Analyse IA en cours',
            message: title || dossierId,
            type: 'info',
            action: 'SHOW_PIPELINE_MODAL',
            silent: false,
            showInBell: true
        });

        this.sseService.connect(dossierId);
        this.sseSub = this.sseService.getEventSubject().subscribe((event: PipelineEvent) => {
            this.handleSseEvent(event, dossierId);
        });
    }

    private handleSseEvent(event: PipelineEvent, dossierId: string) {
        switch (event.type) {
            case 'PIPELINE_START':
                this.clearPhase1Interval();
                this.updateState({ progress: 28, statusLabel: 'Démarrage du Pipeline IA...' });
                break;
            case 'PHASE2_COMPLETED':
                this.clearPhase1Interval();
                this.updateState({ progress: 40, statusLabel: 'Analyse structurelle terminée...' });
                break;
            case 'RISKS_COMPLETED':
                this.updateState({ progress: 50, statusLabel: 'Analyse des risques terminée...' });
                break;
            case 'PWIN_COMPLETED':
                this.updateState({ progress: 70, statusLabel: 'Calcul du P-WIN (Scoring) en cours...' });
                break;
            case 'PIPELINE_STOPPED_NOGO':
                this.updateState({ progress: 100, statusLabel: 'Pipeline arrêté : Génération du rapport No-Go (Score < seuil)', isCompleted: true, completedType: 'warning' });
                
                const titleNogo = this.stateSubj.getValue().dossierTitle;
                this.notificationService.addNotification({
                    title: 'Dossier en No-Go',
                    message: (event.data && event.data.message) ? event.data.message : `Le score P-Win pour "${titleNogo}" est inférieur au seuil. Un rapport NO-GO a été généré.`,
                    detail: (event.data && event.data.detail) ? event.data.detail : undefined,
                    type: 'warning',
                    link: `/dossiers/${dossierId}/no-go-report`,
                    action: 'SHOW_PIPELINE_MODAL',
                    showInBell: true
                });
                
                this.sseService.disconnect(dossierId);
                break;
            case 'MATCHING_COMPLETED':
                this.updateState({ progress: 80, statusLabel: 'Recherche d\'experts (Matching) terminée...' });
                break;
            case 'PIPELINE_PAUSED_FOR_VALIDATION':
                this.updateState({ progress: 100, statusLabel: 'Extraction terminée (100%). Veuillez valider manuellement.', isCompleted: true, completedType: 'success' });
                
                const titleValidation = this.stateSubj.getValue().dossierTitle;
                this.notificationService.addNotification({
                    title: 'Analyse Terminée — Validation requise',
                    message: `L'analyse du dossier "${titleValidation}" est terminée. Cliquez pour valider les données extraites.`,
                    type: 'success',
                    link: `/dossiers/${dossierId}/validation-p1`,
                    action: 'SHOW_PIPELINE_MODAL',
                    showInBell: true
                });
                
                this.sseService.disconnect(dossierId);
                break;
            case 'RECALCUL_COMPLETED':
                this.updateState({ progress: 80, statusLabel: 'Recalcul terminé. Prêt pour génération.' });
                break;
            case 'GENERATION_START':
                this.updateState({ progress: 85, statusLabel: 'Démarrage de la génération des livrables...', isCompleted: false, completedType: null });
                break;
            case 'APO_COMPLETED':
                this.updateState({ progress: 95, statusLabel: 'Génération de l\'APO terminée...' });
                break;
            case 'PIPELINE_COMPLETED':
                this.updateState({ progress: 100, statusLabel: 'Toutes les phases et livrables terminés avec succès !', isCompleted: true, completedType: 'success' });
                
                const title = this.stateSubj.getValue().dossierTitle;
                this.notificationService.addNotification({
                    title: 'Livrables Prêts',
                    message: `Les livrables pour le dossier "${title}" ont été générés avec succès. Cliquez pour les consulter.`,
                    type: 'success',
                    link: `/dossiers/${dossierId}/rapport-final`,
                    action: 'SHOW_PIPELINE_MODAL',
                    showInBell: true
                });
                
                this.sseService.disconnect(dossierId);
                break;
            case 'PIPELINE_ERROR':
                this.clearPhase1Interval();
                this.updateState({ hasError: true, statusLabel: 'Erreur dans le Pipeline IA.' });
                this.sseService.disconnect(dossierId);
                break;
        }
    }

    toggleModal() {
        const current = this.stateSubj.getValue();
        if (current.activeDossierId) {
            this.updateState({ isModalVisible: !current.isModalVisible });
        }
    }

    showModal() {
        const current = this.stateSubj.getValue();
        if (current.activeDossierId) {
            this.updateState({ isModalVisible: true });
        }
    }

    closeModal() {
        this.updateState({ isModalVisible: false });
    }

    stopTracking() {
        this.clearPhase1Interval();
        if (this.sseSub) {
            this.sseSub.unsubscribe();
            this.sseSub = null;
        }
        const current = this.stateSubj.getValue();
        if (current.activeDossierId) {
            this.sseService.disconnect(current.activeDossierId);
        }
        this.updateState({
            activeDossierId: null,
            progress: 0,
            hasError: false,
            isModalVisible: false
        });
    }

    private clearPhase1Interval() {
        if (this.phase1Interval) {
            clearInterval(this.phase1Interval);
            this.phase1Interval = null;
        }
    }

    private updateState(partialState: Partial<PipelineState>) {
        this.stateSubj.next({ ...this.stateSubj.getValue(), ...partialState });
    }
}
