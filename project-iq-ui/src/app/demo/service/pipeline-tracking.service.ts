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
            isModalVisible: true // On l'affiche par défaut au lancement
        });

        // Simuler la progression jusqu'à 25% (Phase 1)
        this.clearPhase1Interval();
        this.phase1Interval = setInterval(() => {
            const current = this.stateSubj.getValue();
            if (current.progress < 25 && !current.hasError) {
                this.updateState({ progress: current.progress + 1 });
            }
        }, 1500);

        // Envoyer la notification "IA a commencé"
        this.notificationService.addNotification({
            title: 'Analyse IA Démarrée',
            message: `L'analyse du dossier "${title || dossierId}" est en cours. Cliquez sur Détails pour suivre la progression.`,
            type: 'info',
            action: 'SHOW_PIPELINE_MODAL'
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
            case 'MATCHING_COMPLETED':
                this.updateState({ progress: 85, statusLabel: 'Recherche d\'experts (Matching) terminée...' });
                break;
            case 'APO_COMPLETED':
                this.updateState({ progress: 95, statusLabel: 'Génération de l\'APO terminée...' });
                break;
            case 'PIPELINE_COMPLETED':
                this.updateState({ progress: 100, statusLabel: 'Toutes les phases terminées avec succès !' });
                
                const title = this.stateSubj.getValue().dossierTitle;
                this.notificationService.addNotification({
                    title: 'Analyse IA Terminée',
                    message: `L'intelligence artificielle a analysé le dossier "${title}" avec succès. Il est prêt pour validation.`,
                    type: 'success',
                    link: `/dossiers/${dossierId}/validation-p1`,
                    action: 'SHOW_PIPELINE_MODAL'
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
