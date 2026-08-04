import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AnalystProjectsService, ExtractionMetadata } from '../../../../service/analyst-projects.service';

interface ExtractedField {
    label: string;
    value: string;
    confidence: number;
    source: string;
}

interface ExtractedSection {
    title: string;
    icon: string;
    color: string;
    fields: ExtractedField[];
}

@Component({
    selector: 'app-extraction-page',
    templateUrl: './extraction-page.component.html',
    styleUrls: ['./extraction-page.component.scss'],
    providers: [MessageService]
})
export class ExtractionPageComponent implements OnInit {

    dossierId = '';
    isLoading = true;
    isWaitingForAI = false;
    extractedData: any = null;
    extractedFields: ExtractionMetadata[] = [];
    
    // APO Preview Toggle
    showApoPreview = false;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private messageService: MessageService,
        private projectsService: AnalystProjectsService
    ) {}

    ngOnInit(): void {
        this.dossierId = this.route.snapshot.paramMap.get('id') || '';
        // Branchement au backend réel
        this.loadExtractionFromBackend();
    }

    private loadExtractionFromBackend(): void {
        this.isLoading = true;
        this.projectsService.getExtractionP1(this.dossierId).subscribe({
            next: (fields) => {
                this.extractedFields = fields;
                
                if (!fields || fields.length === 0) {
                    this.isWaitingForAI = true;
                    setTimeout(() => this.loadExtractionFromBackend(), 3000);
                } else {
                    this.isWaitingForAI = false;
                }
                
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Error loading extraction:', err);
                this.isWaitingForAI = true;
                this.isLoading = false;
                setTimeout(() => this.loadExtractionFromBackend(), 5000);
            }
        });
    }

    get displayFields(): ExtractedField[] {
        // Convert backend ExtractionMetadata to ExtractedField format
        return this.extractedFields.map(f => ({
            label: f.fieldName,
            value: f.valeurFinale || f.valeurClaude || '',
            confidence: f.confiance || 0,
            source: f.sourceExtrait || f.source || ''
        }));
    }

    get groupedFields(): ExtractedSection[] {
        const fields = this.displayFields;
        
        const sectionA = ['INTITULE_OFFRE', 'CLIENT', 'PAYS', 'BAILLEURS'];
        const sectionB = ['DT_LIM_SOUM', 'VISITE_OBL', 'VISITE_DATE', 'CONF_OBL', 'CONF_DATE'];
        const sectionC = ['BUDGET_GLOBAL', 'HOMMES_MOIS', 'LANGUE', 'TJM_IMPLICITE'];

        return [
            {
                title: 'SECTION A — IDENTIFICATION',
                icon: 'pi-id-card',
                color: 'blue',
                fields: fields.filter(f => sectionA.includes(f.label))
            },
            {
                title: 'SECTION B — CALENDRIER',
                icon: 'pi-calendar',
                color: 'orange',
                fields: fields.filter(f => sectionB.includes(f.label))
            },
            {
                title: 'SECTION C — FINANCIER',
                icon: 'pi-dollar',
                color: 'green',
                fields: fields.filter(f => sectionC.includes(f.label))
            }
        ];
    }

    getConfidenceClass(confidence: number): string {
        if (confidence >= 0.9) return 'high';
        if (confidence >= 0.8) return 'medium';
        return 'low';
    }

    get lowConfidenceFields(): ExtractedField[] {
        // Seuil d'alerte défini à 80%
        return this.displayFields.filter(f => f.confidence < 0.80);
    }

    goToValidation(): void {
        if (this.dossierId) {
            this.router.navigate(['/dossiers', this.dossierId, 'validation-p1']);
        }
    }

    // Fournit les données au composant <app-apo-preview>
    get apoPreviewData(): Record<string, string> {
        const result: Record<string, string> = {};
        this.displayFields.forEach(f => { result[f.label] = f.value; });
        return result;
    }

    get apoConfidences(): Record<string, number> {
        const result: Record<string, number> = {};
        this.displayFields.forEach(f => { result[f.label] = f.confidence; });
        return result;
    }

    refresh(): void {
        this.messageService.add({
            severity: 'info',
            summary: 'Actualisation',
            detail: 'Statut: ' + this.extractedData?.status
        });
    }

    reextract(field: ExtractedField, event: Event): void {
        event.stopPropagation();
        this.projectsService.reextractField(this.dossierId, field.label).subscribe({
            next: (res) => {
                // Update local field
                if (field.label === 'VISITE_OBL' || field.label === 'CONF_OBL') {
                    field.value = (res.valeur === true || res.valeur === 'true') ? 'Oui' : 'Non';
                } else {
                    field.value = res.valeur;
                }
                field.confidence = res.confiance ?? field.confidence;
                this.messageService.add({ severity: 'success', summary: 'Ré-extraction', detail: `Champ ${field.label} mis à jour.` });
            },
            error: (err) => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur',
                    detail: err?.error?.message || 'Ré-extraction échouée.'
                });
            }
        });
    }

    toggleApoPreview(): void {
        this.showApoPreview = !this.showApoPreview;
    }
}