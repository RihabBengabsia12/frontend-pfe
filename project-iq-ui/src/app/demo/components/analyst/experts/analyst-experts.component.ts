import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { AnalystService } from '../../../../demo/service/analyst.service';
import { ProjectService, ProjectDTO } from '../../../../demo/service/project.service';

@Component({
    templateUrl: './analyst-experts.component.html',
    providers: [],
    styles: [`
        .upload-zone {
            border: 2px dashed #bbdefb;
            background: #e3f2fd;
        }
        .upload-zone-active {
            border-color: #4A90E2;
            background: #e1f5fe;
        }
    `]
})
export class AnalystExpertsComponent implements OnInit {

    activeTab = 0;

    // ── Extraction CV ──
    isExtracting = false;
    dragOver = false;

    // ── Profils extraits ──
    experts: any[] = [];
    selectedExpert: any = null;
    profileForm = {
        id: '',
        fullName: '',
        skills: '' as string | string[],
        experience: ''
    };
    isSavingProfile = false;
    profilesLoading = false;

    // ── Matrice matching ──
    projects: ProjectDTO[] = [];
    selectedProjectId = '';
    selectedExpertId = '';
    matchScore: number | null = null;
    matchLoading = false;

    constructor(
        private analystService: AnalystService,
        private projectService: ProjectService,
        private messageService: MessageService
    ) {}

    ngOnInit(): void {
        this.loadExperts();
        this.loadProjects();
        this.restoreLastExtraction();
    }

    // ── Extraction ──
    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files?.length) {
            this.uploadCv(input.files[0]);
        }
    }

    onDrop(event: DragEvent): void {
        event.preventDefault();
        this.dragOver = false;
        const file = event.dataTransfer?.files?.[0];
        if (file) {
            this.uploadCv(file);
        }
    }

    onDragOver(event: DragEvent): void {
        event.preventDefault();
        this.dragOver = true;
    }

    onDragLeave(): void {
        this.dragOver = false;
    }

    uploadCv(file: File): void {
        this.isExtracting = true;
        this.analystService.extractCv(file).subscribe({
            next: (res) => {
                this.isExtracting = false;
                const profile = this.normalizeProfile(res);
                sessionStorage.setItem('analyst_last_profile', JSON.stringify(profile));
                this.applyProfileToForm(profile);
                this.activeTab = 1;
                this.loadExperts();
                this.messageService.add({
                    severity: 'success',
                    summary: 'Extraction réussie',
                    detail: 'Profil structuré disponible dans l\'onglet Profils.'
                });
            },
            error: (err) => {
                this.isExtracting = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Extraction échouée',
                    detail: err.error?.message || 'Erreur analyste-service /extract.'
                });
            }
        });
    }

    // ── Profils ──
    loadExperts(): void {
        this.profilesLoading = true;
        this.analystService.getExperts().subscribe({
            next: (data) => {
                this.experts = Array.isArray(data) ? data : [];
                this.profilesLoading = false;
            },
            error: () => {
                this.profilesLoading = false;
                this.experts = [];
            }
        });
    }

    restoreLastExtraction(): void {
        const raw = sessionStorage.getItem('analyst_last_profile')
            || sessionStorage.getItem('lastExtractedProfile');
        if (raw) {
            try {
                this.applyProfileToForm(JSON.parse(raw));
            } catch { /* ignore */ }
        }
    }

    selectExpert(expert: any): void {
        this.selectedExpert = expert;
        this.applyProfileToForm(this.normalizeProfile(expert));
    }

    applyProfileToForm(profile: any): void {
        const skills = profile.skills;
        this.profileForm = {
            id: profile.id || '',
            fullName: profile.fullName || profile.name || '',
            skills: Array.isArray(skills) ? skills.join(', ') : (skills || ''),
            experience: profile.experience || ''
        };
    }

    saveProfile(): void {
        const payload = {
            id: this.profileForm.id || undefined,
            fullName: this.profileForm.fullName,
            skills: typeof this.profileForm.skills === 'string'
                ? this.profileForm.skills.split(',').map(s => s.trim()).filter(Boolean)
                : this.profileForm.skills,
            experience: this.profileForm.experience
        };

        this.isSavingProfile = true;
        this.analystService.updateExtractedProfile(payload).subscribe({
            next: (res) => {
                this.isSavingProfile = false;
                const saved = this.normalizeProfile(res);
                sessionStorage.setItem('analyst_last_profile', JSON.stringify(saved));
                this.messageService.add({ severity: 'success', summary: 'Profil enregistré', detail: 'JSON corrigé envoyé au backend.' });
                this.loadExperts();
            },
            error: (err) => {
                this.isSavingProfile = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Sauvegarde échouée',
                    detail: err.error?.message || 'Erreur PUT /api/analysts/profile.'
                });
            }
        });
    }

    // ── Matching ──
    loadProjects(): void {
        this.projectService.getProjects().subscribe({
            next: (data) => {
                this.projects = Array.isArray(data) ? data : [];
            },
            error: () => {
                this.projects = [];
            }
        });
    }

    computeMatch(): void {
        if (!this.selectedProjectId || !this.selectedExpertId) {
            this.messageService.add({ severity: 'warn', summary: 'Sélection', detail: 'Choisissez un projet et un expert.' });
            return;
        }

        this.matchLoading = true;
        this.matchScore = null;
        this.analystService.getMatchingScore(this.selectedProjectId, this.selectedExpertId).subscribe({
            next: (res) => {
                this.matchLoading = false;
                this.matchScore = res?.score ?? (res as any)?.matchingScore ?? 0;
            },
            error: (err) => {
                this.matchLoading = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Matching',
                    detail: err.error?.message || 'Erreur calcul du score.'
                });
            }
        });
    }

    normalizeProfile(data: any): any {
        if (!data) return {};
        return {
            id: data.id,
            fullName: data.fullName || data.name,
            skills: data.skills || [],
            experience: data.experience || data.experiences || '',
            rawJson: data
        };
    }

    expertLabel(e: any): string {
        return e?.fullName || e?.name || e?.email || 'Expert';
    }
}
