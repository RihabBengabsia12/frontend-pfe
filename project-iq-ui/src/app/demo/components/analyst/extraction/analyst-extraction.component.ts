import { Component } from '@angular/core';
import { MessageService } from 'primeng/api';
import { AnalystService } from '../../../../demo/service/analyst.service';

@Component({
    selector: 'app-analyst-extraction',
    templateUrl: './analyst-extraction.component.html',
    providers: [MessageService]
})
export class AnalystExtractionComponent {

    isUploading = false;
    dragOver = false;
    lastExtracted: any = null;



    constructor(
        private analystService: AnalystService,
        private messageService: MessageService
    ) {}

    onDragOver(event: DragEvent): void {
        event.preventDefault();
        this.dragOver = true;
    }

    onDragLeave(): void {
        this.dragOver = false;
    }

    onDrop(event: DragEvent): void {
        event.preventDefault();
        this.dragOver = false;
        const file = event.dataTransfer?.files?.[0];
        if (file) this.uploadFile(file);
    }

    onFileSelect(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (file) this.uploadFile(file);
        input.value = '';
    }

    uploadFile(file: File): void {
        const allowed = ['application/pdf', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|doc|docx)$/i)) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Format non supporté',
                detail: 'Veuillez charger un CV au format PDF ou Word.'
            });
            return;
        }

        this.isUploading = true;
        this.analystService.extractCv(file).subscribe({
            next: (result) => {
                this.lastExtracted = this.normalizeProfile(result);
                sessionStorage.setItem('lastExtractedProfile', JSON.stringify(this.lastExtracted));
                this.isUploading = false;
                this.messageService.add({
                    severity: 'success',
                    summary: 'Extraction réussie',
                    detail: 'Le CV a été converti en données structurées.'
                });
            },
            error: (err) => {
                this.isUploading = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur extraction',
                    detail: err.error?.message || 'Le service analyste n\'a pas pu traiter le fichier.'
                });
            }
        });
    }

    private normalizeProfile(raw: any): any {
        return {
            id: raw.id,
            fullName: raw.fullName || raw.name || '',
            skills: Array.isArray(raw.skills) ? raw.skills : (raw.skills ? String(raw.skills).split(',') : []),
            experience: raw.experience || raw.experiences || '',
            rawJson: typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2)
        };
    }
}
