import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AnalystProjectsService } from '../../../service/analyst-projects.service';

@Component({
    selector: 'app-pack-ready-page',
    templateUrl: './pack-ready-page.component.html',
    styleUrls: ['./pack-ready-page.component.scss'],
    providers: []
})
export class PackReadyPageComponent implements OnInit {
    dossierId: string = '';
    isLoading = false;
    isDownloading = false;
    isSending = false;

    documents = [
        { name: 'APO_Final.docx', size: '342 KB', type: 'word', icon: 'pi pi-file-word text-blue-600', bg: 'bg-blue-50' },
        { name: 'Methodologie.docx', size: '218 KB', type: 'word', icon: 'pi pi-file-word text-blue-600', bg: 'bg-blue-50' },
        { name: 'Rapport_Analyse.pdf', size: '156 KB', type: 'pdf', icon: 'pi pi-file-pdf text-red-600', bg: 'bg-red-50' },
        { name: 'Checklist_Soumission.pdf', size: '48 KB', type: 'pdf', icon: 'pi pi-check-square text-green-600', bg: 'bg-green-50' }
    ];

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private projectsService: AnalystProjectsService,
        private messageService: MessageService
    ) {}

    ngOnInit(): void {
        this.route.params.subscribe(params => {
            this.dossierId = params['id'];
        });
        
        // Show success message that compilation is done
        setTimeout(() => {
            this.messageService.add({ severity: 'success', summary: 'Compilation terminée', detail: 'Tous les livrables ont été générés avec succès.' });
        }, 500);
    }

    downloadPack(): void {
        this.isDownloading = true;
        // Simulons le téléchargement du ZIP (qui pourrait appeler POST /api/export/{id}/pack-zip et récupérer un blob)
        setTimeout(() => {
            this.isDownloading = false;
            this.messageService.add({ severity: 'success', summary: 'Téléchargement', detail: 'Le pack ZIP a été téléchargé.' });
        }, 2000);
    }

    sendToManager(): void {
        if (!this.dossierId) return;
        this.isSending = true;
        
        this.projectsService.sendToValidators(this.dossierId).subscribe({
            next: () => {
                this.isSending = false;
                this.messageService.add({ 
                    severity: 'success', 
                    summary: 'Soumis à la Direction', 
                    detail: 'Le dossier a été envoyé aux managers pour validation finale.' 
                });
                
                setTimeout(() => {
                    this.router.navigate(['/analyst/dashboard']);
                }, 2000);
            },
            error: (err) => {
                this.isSending = false;
                this.messageService.add({ 
                    severity: 'error', 
                    summary: 'Erreur', 
                    detail: 'Impossible de soumettre le dossier à la direction.' 
                });
                console.error(err);
            }
        });
    }
}
