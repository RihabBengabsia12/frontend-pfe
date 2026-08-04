import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import {
    AnalystProject,
    AnalystProjectsService
} from '../../../../demo/service/analyst-projects.service';

@Component({
    templateUrl: './analyst-analyses.component.html',
    providers: [MessageService]
})
export class AnalystAnalysesComponent implements OnInit {

    projects: AnalystProject[] = [];
    isLoading = false;

    displayResultDialog = false;
    selectedProject: AnalystProject | null = null;
    analysisLoading = false;
    analysis: any = null;

    constructor(
        private projectsService: AnalystProjectsService,
        private messageService: MessageService
    ) {}

    ngOnInit(): void {
        this.loadProjects();
    }

    loadProjects(): void {
        this.isLoading = true;
        this.projectsService.listProjects().subscribe({
            next: (data) => {
                const all = Array.isArray(data) ? data : [];
                this.projects = all.filter(p => (p.status || '').toUpperCase() === 'EXTRACTED');
                this.isLoading = false;
            },
            error: () => {
                // On ne bloque pas l’UI si la liste est vide / indisponible.
                this.projects = [];
                this.isLoading = false;
            }
        });
    }

    openResults(project: AnalystProject): void {
        this.selectedProject = project;
        this.displayResultDialog = true;
        this.analysisLoading = true;
        this.analysis = null;
        this.projectsService.getAnalysisResult(project.id).subscribe({
            next: (res) => {
                this.analysisLoading = false;
                this.analysis = this.parseAnalysis(res?.aiAnalysisJson);
            },
            error: () => {
                this.analysisLoading = false;
                this.analysis = null;
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Résultats indisponibles',
                    detail: 'Le résultat IA n\'a pas pu être récupéré.'
                });
            }
        });
    }

    closeResults(): void {
        this.displayResultDialog = false;
        this.selectedProject = null;
        this.analysis = null;
    }

    download(project: AnalystProject): void {
        if (!project?.id) return;
        this.projectsService.downloadProject(project.id).subscribe({
            next: (blob) => {
                this.projectsService.triggerBrowserDownload(blob, project.fileName || `document-${project.id}`);
            },
            error: () => {
                this.messageService.add({ severity: 'error', summary: 'Téléchargement', detail: 'Fichier introuvable.' });
            }
        });
    }

    private parseAnalysis(raw: any): any {
        if (!raw) return null;
        let obj: any = raw;
        if (typeof raw === 'string') {
            try { obj = JSON.parse(raw); } catch { obj = { rawText: raw }; }
        }
        return {
            summary: obj.summary || obj.resume || obj.projectSummary || obj.description || '',
            objectives: this.asArray(obj.objectives || obj.goals),
            skills: this.asArray(obj.skills || obj.competences || obj.keySkills),
            technologies: this.asArray(obj.technologies || obj.tech || obj.stack),
            deliverables: this.asArray(obj.deliverables || obj.livrables),
            duration: obj.duration || obj.duree || '',
            budget: obj.budget || ''
        };
    }

    private asArray(value: any): string[] {
        if (!value) return [];
        if (Array.isArray(value)) return value.map(v => String(v));
        if (typeof value === 'string') return value.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
        return [String(value)];
    }
}
