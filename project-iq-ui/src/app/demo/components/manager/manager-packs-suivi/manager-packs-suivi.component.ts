import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ManagerValidationService } from '../../../service/manager-validation.service';
import { catchError } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';

@Component({
  selector: 'app-manager-packs-suivi',
  templateUrl: './manager-packs-suivi.component.html',
  styleUrls: ['./manager-packs-suivi.component.scss'],
  providers: []
})
export class ManagerPacksSuiviComponent implements OnInit {

  dossiers: any[] = [];
  loading: boolean = true;
  searchTerm: string = '';

  // Colonnes du Kanban
  matchingDossiers: any[] = [];
  draftingDossiers: any[] = [];
  readyDossiers: any[] = [];

  constructor(
    private validationService: ManagerValidationService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.loadSuivi();
  }

  loadSuivi() {
    this.loading = true;
    this.validationService.getDossiersForSuivi().subscribe({
      next: (data) => {
        forkJoin(data.map(dossier =>
          this.validationService.getValidationStatus(dossier.id).pipe(catchError(() => of([])))
        )).subscribe({
          next: (allDecisions) => {
            this.dossiers = data
              .map((dossier, index) => ({ ...dossier, decisions: allDecisions[index] }))
              .filter(dossier => !this.hasFinalDecision(dossier.decisions));
            this.organizeKanban();
            this.loading = false;
          },
          error: () => {
            this.dossiers = data;
            this.organizeKanban();
            this.loading = false;
          }
        });
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger le suivi' });
        this.loading = false;
      }
    });
  }

  onSearch() {
    this.organizeKanban();
  }

  organizeKanban() {
    // Filtrage par recherche
    let filtered = this.dossiers;
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = this.dossiers.filter(d => 
        (d.intituleOffre && d.intituleOffre.toLowerCase().includes(term)) ||
        (d.client && d.client.toLowerCase().includes(term))
      );
    }

    // Répartition dans les colonnes
    this.matchingDossiers = filtered.filter(d => d.status === 'MATCHING');
    this.draftingDossiers = filtered.filter(d => d.status === 'DRAFTING');
    this.readyDossiers = filtered.filter(d =>
      d.status === 'PACK_READY' || d.status === 'PENDING_VALIDATION'
    );
  }

  hasFinalDecision(decisions: any[]): boolean {
    const active = (decisions || []).filter(d => !['CANCELLED', 'EXPIRED'].includes(d.status));
    return active.some(d => ['REJECTED', 'APPROVE_NOGO'].includes(d.status))
      || (active.length > 0 && active.every(d => d.status === 'APPROVED'));
  }

  decisionProgress(dossier: any): string {
    if (dossier.status === 'PACK_READY') return 'Prêt à envoyer aux décideurs';
    const approved = (dossier.decisions || []).filter((d: any) => d.status === 'APPROVED').length;
    const total = (dossier.decisions || []).filter((d: any) => !['CANCELLED', 'EXPIRED'].includes(d.status)).length;
    return `En attente des décideurs (${approved}/${total || 4} GO)`;
  }

  getScoreColor(score: number): string {
    if (!score) return 'text-500';
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-orange-500';
    return 'text-red-500';
  }
}
