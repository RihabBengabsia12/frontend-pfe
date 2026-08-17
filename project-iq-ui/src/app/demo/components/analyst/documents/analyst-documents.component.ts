import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import {
    AnalystProject,
    AnalystProjectsService
} from '../../../../demo/service/analyst-projects.service';

@Component({
    templateUrl: './analyst-documents.component.html',
    providers: []
})
export class AnalystDocumentsComponent implements OnInit {

    projects: AnalystProject[] = [];
    isLoading = false;
    searchTerm = '';

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
                this.projects = Array.isArray(data) ? data : [];
                this.isLoading = false;
            },
            error: () => {
                this.projects = [];
                this.isLoading = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur',
                    detail: 'GET /api/projects indisponible.'
                });
            }
        });
    }

    download(project: AnalystProject): void {
        if (!project?.id) return;
        this.projectsService.downloadProject(project.id).subscribe({
            next: (blob) => {
                this.projectsService.triggerBrowserDownload(blob, project.fileName || `document-${project.id}`);
            },
            error: () => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Téléchargement',
                    detail: 'Fichier introuvable.'
                });
            }
        });
    }

    get filtered(): AnalystProject[] {
        const term = this.searchTerm.trim().toLowerCase();
        if (!term) return this.projects;
        return this.projects.filter(p =>
            (p.title || '').toLowerCase().includes(term) ||
            (p.fileName || '').toLowerCase().includes(term) ||
            (p.description || '').toLowerCase().includes(term)
        );
    }

    statusLabel(status: string): string {
        switch ((status || '').toUpperCase()) {
            case 'UPLOADED': return 'Importé';
            case 'EXTRACTING': return 'Extraction en cours';
            case 'EXTRACTED': return 'Analyse disponible';
            default: return status || '—';
        }
    }

    statusSeverity(status: string): 'success' | 'warning' | 'info' | 'danger' {
        switch ((status || '').toUpperCase()) {
            case 'EXTRACTED': return 'success';
            case 'EXTRACTING': return 'warning';
            case 'UPLOADED': return 'info';
            default: return 'info';
        }
    }
}
