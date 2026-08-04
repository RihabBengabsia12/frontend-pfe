import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ScoringService, PwinScore, ScoringResult } from '../../../service/scoring.service';
import { AnalystProjectsService } from '../../../service/analyst-projects.service';

@Component({
    selector: 'app-scoring-page',
    templateUrl: './scoring-page.component.html',
    styleUrls: ['./scoring-page.component.scss'],
    providers: [MessageService]
})
export class ScoringPageComponent implements OnInit {
    projectId: string = '';
    scoringData!: ScoringResult;
    isLoading = true;
    showOverruleModal = false;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private scoringService: ScoringService,
        private projectsService: AnalystProjectsService,
        private messageService: MessageService
    ) {}

    ngOnInit(): void {
        this.route.params.subscribe(params => {
            this.projectId = params['id'] || 'TEST-PROJECT-001';
            this.loadScoring();
        });
    }

    loadScoring(): void {
        this.isLoading = true;
        this.scoringService.getResult(this.projectId).subscribe({
            next: (pwin: PwinScore) => {
                // Transform model backend → model UI
                this.scoringData = this.scoringService.toScoringResult(pwin);
                this.isLoading = false;
            },

            error: () => {
                this.isLoading = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur',
                    detail: 'Impossible de calculer le score P-Win.'
                });
            }
        });
    }

    getDecisionCardClass(): string {
        if (!this.scoringData) return '';
        if (this.scoringData.pwinScore >= this.scoringData.goThreshold) {
            return 'card-pastel-green text-green-900 border-green-300';
        }
        if (this.scoringData.pwinScore >= this.scoringData.nogoThreshold) {
            return 'card-pastel-amber text-amber-900 border-amber-300';
        }
        return 'card-pastel-danger text-red-900 border-red-300';
    }

    getDecisionBadgeClass(): string {
        if (!this.scoringData) return '';
        if (this.scoringData.pwinScore >= this.scoringData.goThreshold) {
            return 'bg-green-100 text-green-700';
        }
        if (this.scoringData.pwinScore >= this.scoringData.nogoThreshold) {
            return 'bg-orange-100 text-orange-700';
        }
        return 'bg-red-100 text-red-700';
    }

    onConfirmGo(): void {
        this.projectsService.updateStatus(this.projectId, 'MATCHING').subscribe({
            next: () => this.router.navigate(['/dossiers', this.projectId, 'matching']),
            error: () => this.router.navigate(['/dossiers', this.projectId, 'matching'])
        });
    }

    onConfirmNoGo(): void {
        this.scoringService.confirmNoGo(this.projectId).subscribe({
            next: () => {
                // Redirection immédiate vers l'écran de Rapport No-Go
                this.router.navigate(['/dossiers', this.projectId, 'no-go-report']);
            }
        });
    }


    onOverruleClick(): void {
        this.showOverruleModal = true;
    }

    onOverruleConfirmed(event: { signature: string, comment: string }): void {
        this.isLoading = true;
        const forcedBy = localStorage.getItem('userEmail') || 'MANAGER';
        // backend signature: forceGo(dossierId, justification, type, forcedBy)
        this.scoringService.forceGo(this.projectId, event.comment, event.signature, forcedBy).subscribe({
            next: (res) => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Opportunité forcée (Overrule)',
                    detail: 'Signature managériale enregistrée. Redirection...'
                });
                setTimeout(() => {
                    this.router.navigate(['/analyst/dashboard']);
                }, 1500);
            },
            error: () => {
                this.isLoading = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur',
                    detail: 'Le forçage a échoué.'
                });
            }
        });
    }
}
