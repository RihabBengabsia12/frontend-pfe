import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';

export interface PipelineStep {
  label: string;
  icon: string;
}

export interface PipelineContext {
  phaseTag: string;
  title: string;
  subtitle: string;
  icon: string;
  iconColor: string;
}

/** Contextes Phase 2 — Extraction & Formulaire APO */
export const PIPELINE_CONTEXTS: Record<string, PipelineContext> = {
  clauses: {
    phaseTag: 'Phase 2',
    title: 'ProjectIQ — Clauses & Éligibilité',
    subtitle: 'Validation des clauses contractuelles, critères d\'éligibilité et champs financiers extraits par Claude IA.',
    icon: 'pi pi-file-edit',
    iconColor: '#1976d2'
  },
  risks: {
    phaseTag: 'Phase 2',
    title: 'ProjectIQ — Grille des Risques',
    subtitle: 'Évaluation des 10 risques non maîtrisables. Un critère rédhibitoire force le P-Win à 0%.',
    icon: 'pi pi-exclamation-triangle',
    iconColor: '#c2410c'
  },
  scoring: {
    phaseTag: 'Phase 2',
    title: 'ProjectIQ — Calcul P-Win',
    subtitle: 'Scoring algorithmique sur 5 axes pondérés. Recommandation Go / No-Go générée automatiquement.',
    icon: 'pi pi-chart-bar',
    iconColor: '#2d6a4f'
  },
  nogo: {
    phaseTag: 'Phase 2',
    title: 'ProjectIQ — Arbitrage & No-Go',
    subtitle: 'Rapport d\'audit officiel, motifs de rejet et option de forçage superviseur (100 mots min.).',
    icon: 'pi pi-ban',
    iconColor: '#a12b39'
  },
  matching: {
    phaseTag: 'Phase 3',
    title: 'Matching, Matrice de Différenciation & Extraction Stratégique',
    subtitle: 'Comparaison exigences AO ↔ référentiel Egis. Extraction des champs optionnels stratégiques et génération de la matrice de différenciation.',
    icon: 'pi pi-percentage',
    iconColor: '#7c3aed'
  },
  deposit: {
    phaseTag: 'Phase 1',
    title: 'ProjectIQ — Dépôt & Extraction',
    subtitle: 'Dépôt fusionné AP & TDR, extraction automatique par Claude IA et validation métier.',
    icon: 'pi pi-play',
    iconColor: '#1976d2'
  },
  'deep-analysis': {
    phaseTag: 'Phase 2',
    title: 'ProjectIQ — Analyse Approfondie',
    subtitle: 'Extraction approfondie des clauses contractuelles et évaluation des risques (P-Win).',
    icon: 'pi pi-search-plus',
    iconColor: '#6366f1'
  },
  'rapport-final': {
    phaseTag: 'Phase 4',
    title: 'ProjectIQ — Rapport Général',
    subtitle: 'Génération et consolidation du rapport d\'analyse final reprenant toutes les phases.',
    icon: 'pi pi-file-pdf',
    iconColor: '#dc2626'
  },
  'apo-editor': {
    phaseTag: 'Phase 4',
    title: 'ProjectIQ — Éditeur APO',
    subtitle: 'Validation et édition des 65 champs de l\'APO avant génération du livrable final.',
    icon: 'pi pi-file-edit',
    iconColor: '#0ea5e9'
  },
  'pack-ready': {
    phaseTag: 'Phase 4',
    title: 'ProjectIQ — Pack Soumission',
    subtitle: 'Téléchargement de l\'archive ZIP contenant l\'intégralité des rapports générés.',
    icon: 'pi pi-box',
    iconColor: '#16a34a'
  }
};

@Component({
  selector: 'app-pipeline-stepper',
  templateUrl: './pipeline-stepper.component.html',
  styleUrls: ['./pipeline-stepper.component.scss']
})
export class PipelineStepperComponent {
  /** phase1 = 4 étapes (Dépôt→Indexé) | phase2 = 2 étapes (Extraction→Décision) | phase3 = 2 étapes */
  @Input() mode: 'phase1' | 'phase2' | 'phase3' | 'phase4' = 'phase2';

  /** Étape active (index 0-based) */
  @Input() activeStep = 0;

  @Input() dossierId: string | null = null;

  @Input() set context(key: string) {
    this._ctx = PIPELINE_CONTEXTS[key] ?? PIPELINE_CONTEXTS['clauses'];
  }

  _ctx: PipelineContext = PIPELINE_CONTEXTS['clauses'];

  /** Phase 1 — Chevron workflow (Dépôt, Extraction, Validation, Indexation) */
  phase1Steps: PipelineStep[] = [
    { label: 'Dépôt',      icon: 'pi pi-cloud-upload' },
    { label: 'Extraction IA', icon: 'pi pi-cog' },
    { label: 'Validation', icon: 'pi pi-verified' },
    { label: 'Indexation', icon: 'pi pi-server' },
  ];

  /** Phase 2 — Analyse Approfondie */
  phase2Steps: PipelineStep[] = [
    { label: 'Extraction Approfondie', icon: 'pi pi-cog' },
    { label: 'Calcul P-Win', icon: 'pi pi-chart-bar' },
    { label: 'Décision', icon: 'pi pi-check-circle' }
  ];

  /** Phase 3 — Matching */
  phase3Steps: PipelineStep[] = [
    { label: 'Référentiel matching', icon: 'pi pi-percentage' },
    { label: 'Génération méthodologie', icon: 'pi pi-file' }
  ];

  /** Phase 4 — Finalisation APO & Pack */
  phase4Steps: PipelineStep[] = [
    { label: 'Rapport Général', icon: 'pi pi-file-pdf' },
    { label: 'Éditeur APO', icon: 'pi pi-file-edit' },
    { label: 'Pack Soumission', icon: 'pi pi-box' }
  ];

  constructor(private router: Router) {}

  get steps(): PipelineStep[] {
    if (this.mode === 'phase4') return this.phase4Steps;
    if (this.mode === 'phase3') return this.phase3Steps;
    return this.mode === 'phase2' ? this.phase2Steps : this.phase1Steps;
  }

  get progressWidth(): number {
    const max = this.steps.length - 1;
    if (this.mode === 'phase1') {
      return ((this.activeStep) / max) * 100;
    }
    return max > 0 ? (this.activeStep / max) * 90 : 0;
  }

  isCompleted(i: number): boolean { return i < this.activeStep; }
  isActive(i: number): boolean { return i === this.activeStep; }

  onStepClick(i: number): void {
    if (this.mode !== 'phase1' && this.mode !== 'phase4') return;
    if (i > this.activeStep) return; // Can't skip forward

    if (this.mode === 'phase1') {
        if (i === 0) {
          this.router.navigate(['/dossiers/nouveau']);
        } else if (i === 1 && this.dossierId) {
          this.router.navigate(['/dossiers', this.dossierId, 'extraction']);
        } else if (i === 2 && this.dossierId) {
          this.router.navigate(['/dossiers', this.dossierId, 'validation-p1']);
        } else if (i === 3) {
          this.router.navigate(['/dossiers']);
        }
    } else if (this.mode === 'phase4' && this.dossierId) {
        if (i === 0) {
            this.router.navigate(['/dossiers', this.dossierId, 'rapport-final']);
        } else if (i === 1) {
            this.router.navigate(['/dossiers', this.dossierId, 'apo-editor']);
        } else if (i === 2) {
            this.router.navigate(['/dossiers', this.dossierId, 'pack']);
        }
    }
  }
}
