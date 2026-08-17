import { Component, OnInit } from '@angular/core';
import { ReferentielService, Competence, ReferenceProjet, ExpertProfil } from '../../../service/referentiel.service';
import { MessageService } from 'primeng/api';

@Component({
    selector: 'app-referentiel-page',
    templateUrl: './referentiel-page.component.html',
    styleUrls: ['./referentiel-page.component.scss'],
    providers: []
})
export class ReferentielPageComponent implements OnInit {

    // Data
    competences: Competence[] = [];
    references: ReferenceProjet[] = [];
    experts: ExpertProfil[] = [];

    // Dialog state
    compDialog: boolean = false;
    refDialog: boolean = false;
    expertDialog: boolean = false;

    // Current models
    comp: Competence = { domaine: '' };
    ref: ReferenceProjet = { titre: '' };
    expert: ExpertProfil = { nom: '' };

    // Loading states
    loadingComp: boolean = false;
    loadingRef: boolean = false;
    loadingExpert: boolean = false;

    // Options
    niveaux = [
        { label: 'DEBUTANT', value: 'DEBUTANT' },
        { label: 'CONFIRME', value: 'CONFIRME' },
        { label: 'EXPERT', value: 'EXPERT' },
        { label: 'REFERENCE', value: 'REFERENCE' }
    ];

    constructor(
        private referentielService: ReferentielService,
        private messageService: MessageService
    ) {}

    ngOnInit(): void {
        this.loadCompetences();
        this.loadReferences();
        this.loadExperts();
    }

    // --- COMPÉTENCES ---
    loadCompetences() {
        this.loadingComp = true;
        this.referentielService.getCompetences().subscribe({
            next: (data) => {
                this.competences = data;
                this.loadingComp = false;
            },
            error: () => {
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger les compétences' });
                this.loadingComp = false;
            }
        });
    }

    openNewComp() {
        this.comp = { domaine: '', niveau: 'EXPERT', actif: true };
        this.compDialog = true;
    }

    editComp(comp: Competence) {
        this.comp = { ...comp };
        this.compDialog = true;
    }

    saveComp() {
        if (this.comp.id) {
            this.referentielService.updateCompetence(this.comp.id, this.comp).subscribe({
                next: () => {
                    this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Compétence mise à jour' });
                    this.loadCompetences();
                    this.compDialog = false;
                },
                error: () => this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Mise à jour échouée' })
            });
        } else {
            this.referentielService.createCompetence(this.comp).subscribe({
                next: () => {
                    this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Compétence créée' });
                    this.loadCompetences();
                    this.compDialog = false;
                },
                error: () => this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Création échouée' })
            });
        }
    }

    deleteComp(comp: Competence) {
        if (comp.id) {
            this.referentielService.deleteCompetence(comp.id).subscribe({
                next: () => {
                    this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Compétence désactivée/supprimée' });
                    this.loadCompetences();
                },
                error: () => this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Suppression échouée' })
            });
        }
    }

    // --- RÉFÉRENCES ---
    loadReferences() {
        this.loadingRef = true;
        this.referentielService.getReferences().subscribe({
            next: (data) => {
                this.references = data;
                this.loadingRef = false;
            },
            error: () => {
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger les références' });
                this.loadingRef = false;
            }
        });
    }

    openNewRef() {
        this.ref = { titre: '', actif: true };
        this.refDialog = true;
    }

    editRef(ref: ReferenceProjet) {
        this.ref = { ...ref };
        this.refDialog = true;
    }

    saveRef() {
        if (this.ref.id) {
            this.referentielService.updateReference(this.ref.id, this.ref).subscribe({
                next: () => {
                    this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Référence mise à jour' });
                    this.loadReferences();
                    this.refDialog = false;
                },
                error: () => this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Mise à jour échouée' })
            });
        } else {
            this.referentielService.createReference(this.ref).subscribe({
                next: () => {
                    this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Référence créée' });
                    this.loadReferences();
                    this.refDialog = false;
                },
                error: () => this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Création échouée' })
            });
        }
    }

    deleteRef(ref: ReferenceProjet) {
        if (ref.id) {
            this.referentielService.deleteReference(ref.id).subscribe({
                next: () => {
                    this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Référence supprimée' });
                    this.loadReferences();
                },
                error: () => this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Suppression échouée' })
            });
        }
    }

    // --- EXPERTS ---
    loadExperts() {
        this.loadingExpert = true;
        this.referentielService.getExperts().subscribe({
            next: (data) => {
                this.experts = data;
                this.loadingExpert = false;
            },
            error: () => {
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger les experts' });
                this.loadingExpert = false;
            }
        });
    }

    openNewExpert() {
        this.expert = { nom: '', actif: true };
        this.expertDialog = true;
    }

    editExpert(expert: ExpertProfil) {
        this.expert = { ...expert };
        this.expertDialog = true;
    }

    private formatDate(date: any): any {
        if (!date) return null;
        if (typeof date === 'string') return date.split('T')[0];
        const d = new Date(date);
        const month = '' + (d.getMonth() + 1);
        const day = '' + d.getDate();
        const year = d.getFullYear();
        return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
    }

    saveExpert() {
        const payload = { ...this.expert };
        payload.disponibleDu = this.formatDate(payload.disponibleDu);
        payload.disponibleAu = this.formatDate(payload.disponibleAu);

        if (payload.id) {
            this.referentielService.updateExpert(payload.id, payload).subscribe({
                next: () => {
                    this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Expert mis à jour' });
                    this.loadExperts();
                    this.expertDialog = false;
                },
                error: () => this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Mise à jour échouée' })
            });
        } else {
            this.referentielService.createExpert(payload).subscribe({
                next: () => {
                    this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Expert créé' });
                    this.loadExperts();
                    this.expertDialog = false;
                },
                error: () => this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Création échouée' })
            });
        }
    }

    deleteExpert(expert: ExpertProfil) {
        if (expert.id) {
            this.referentielService.deleteExpert(expert.id).subscribe({
                next: () => {
                    this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Expert supprimé' });
                    this.loadExperts();
                },
                error: () => this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Suppression échouée' })
            });
        }
    }
}
