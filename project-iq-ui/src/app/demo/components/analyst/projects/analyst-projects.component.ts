import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ProjectService, ProjectDTO } from '../../../../demo/service/project.service';
import { AnalystService } from '../../../../demo/service/analyst.service';

@Component({
    templateUrl: './analyst-projects.component.html',
    providers: [MessageService],
    styles: [`
        .tdr-json-viewer {
            background: #1e293b;
            color: #38bdf8;
            font-family: monospace;
            padding: 1.5rem;
            border-radius: 8px;
            max-height: 300px;
            overflow-y: auto;
            white-space: pre-wrap;
        }
    `]
})
export class AnalystProjectsComponent implements OnInit {

    projects: ProjectDTO[] = [];
    experts: any[] = [];
    isLoading = false;
    showTdrDialog = false;
    showAssignDialog = false;
    selectedProject: ProjectDTO | null = null;
    selectedExpertId = '';
    tdrData: any = null;
    tdrLoading = false;

    constructor(
        private projectService: ProjectService,
        private analystService: AnalystService,
        private messageService: MessageService
    ) {}

    ngOnInit(): void {
        this.loadProjects();
        this.loadExperts();
    }

    loadProjects(): void {
        this.isLoading = true;
        this.projectService.getProjects().subscribe({
            next: (data) => {
                this.projects = Array.isArray(data) ? data : [];
                this.isLoading = false;
            },
            error: () => {
                this.isLoading = false;
                this.projects = [];
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur API',
                    detail: 'Impossible de charger les projets (project-service).'
                });
            }
        });
    }

    loadExperts(): void {
        this.analystService.getExperts().subscribe({
            next: (data) => {
                this.experts = Array.isArray(data) ? data : [];
            },
            error: () => {
                this.experts = [];
            }
        });
    }

    openTdr(project: ProjectDTO): void {
        this.selectedProject = project;
        this.showTdrDialog = true;
        this.tdrLoading = true;
        this.tdrData = null;

        if (!project.id) {
            this.tdrLoading = false;
            this.tdrData = { message: 'Identifiant projet manquant.' };
            return;
        }

        this.projectService.getTdrJson(project.id).subscribe({
            next: (json) => {
                this.tdrData = json;
                this.tdrLoading = false;
            },
            error: () => {
                this.tdrLoading = false;
                try {
                    this.tdrData = project.tdrContent ? JSON.parse(project.tdrContent) : { message: 'TDR non disponible.' };
                } catch {
                    this.tdrData = { rawText: project.tdrContent || 'TDR non disponible.' };
                }
            }
        });
    }

    openAssign(project: ProjectDTO): void {
        this.selectedProject = project;
        this.selectedExpertId = '';
        this.showAssignDialog = true;
    }

    onAssignExpert(): void {
        if (!this.selectedProject?.id || !this.selectedExpertId) {
            this.messageService.add({ severity: 'warn', summary: 'Sélection', detail: 'Choisissez un expert.' });
            return;
        }

        const expert = this.experts.find(e => e.id === this.selectedExpertId);
        const expertName = expert?.name || expert?.fullName || 'Expert';

        this.projectService.assignExpert(this.selectedProject.id, this.selectedExpertId).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Affectation',
                    detail: `${expertName} affecté au projet.`
                });
                this.showAssignDialog = false;
                this.loadProjects();
            },
            error: (err) => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Échec affectation',
                    detail: err.error?.message || 'Erreur project-service /assign.'
                });
            }
        });
    }

    expertLabel(expert: any): string {
        return expert?.name || expert?.fullName || expert?.email || 'Expert';
    }

    getStatusSeverity(status: string): string {
        switch ((status || '').toUpperCase()) {
            case 'INITIALISÉ':
            case 'INITIALISE': return 'info';
            case 'EN_COURS': return 'warning';
            case 'CLÔTURÉ':
            case 'CLOTURE': return 'success';
            default: return 'info';
        }
    }
}
