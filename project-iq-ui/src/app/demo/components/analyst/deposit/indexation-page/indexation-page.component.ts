import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AnalystProjectsService, AuditEntry } from '../../../../service/analyst-projects.service';
import { MessageService } from 'primeng/api';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SseService } from '../../../../../services/sse.service';

@Component({
    selector: 'app-indexation-page',
    templateUrl: './indexation-page.component.html',
    styleUrls: ['./indexation-page.component.scss'],
    providers: []
})
export class IndexationPageComponent implements OnInit {
    dossierId: string = '';
    isLoading: boolean = true;
    backendPdfUrl?: SafeResourceUrl;
    
    // APO Document data
    apoData: Record<string, string> = {
        INTITULE_OFFRE: '...',
        CLIENT: '...',
        PAYS: '...',
        BAILLEURS: '...',
        DT_LIM_SOUM: '...',
        VISITE_OBL: '...',
        VISITE_DATE: '...',
        CONF_OBL: '...',
        CONF_DATE: '...',
        BUDGET_GLOBAL: '...',
        HOMMES_MOIS: '...',
        LANGUE: '...',
        TJM_IMPLICITE: '...'
    };

    // Timeline data
    timelineEvents: any[] = [];
    showAuditLog: boolean = true;
    showTimeline: boolean = true;
    
    private sseSub?: import('rxjs').Subscription;

    get apoFieldKeys(): string[] {
        return Object.keys(this.apoData);
    }

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private projectsService: AnalystProjectsService,
        private messageService: MessageService,
        private sanitizer: DomSanitizer,
        private sseService: SseService
    ) {}

    ngOnInit(): void {
        this.dossierId = this.route.snapshot.paramMap.get('id') || '';
        this.backendPdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl('assets/APO-Formulaire Etudes-Template.pdf');
        this.loadData();

        this.sseService.connect(this.dossierId);
        this.sseSub = this.sseService.getEvents().subscribe({
            next: (msg) => {
                if (msg.type === 'INIT') return;
                
                this.messageService.add({
                    severity: msg.type === 'PIPELINE_ERROR' ? 'error' : 'success',
                    summary: 'Cascade Asynchrone',
                    detail: typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data)
                });
                
                // Rafraîchir l'historique quand un événement survient
                this.buildTimeline();
            }
        });
    }

    ngOnDestroy(): void {
        this.sseSub?.unsubscribe();
        this.sseService.disconnect();
    }

    private loadData(): void {
        this.isLoading = true;
        // Simulation d'un délai d'indexation
        setTimeout(() => {
            this.projectsService.getExtractionP1(this.dossierId).subscribe({
                next: (metas) => {
                    if (!metas || metas.length === 0) {
                        // L'API a retourné un tableau vide, rien à injecter.
                    } else {
                        metas.forEach(m => {
                            if (this.apoData[m.fieldName] !== undefined) {
                                this.apoData[m.fieldName] = m.valeurFinale || m.valeurClaude || 'N/A';
                            }
                        });
                        // Format dates/booleans si besoin
                        if (String(this.apoData['VISITE_OBL']).toLowerCase() === 'true') this.apoData['VISITE_OBL'] = 'Oui';
                        else if (String(this.apoData['VISITE_OBL']).toLowerCase() === 'false') this.apoData['VISITE_OBL'] = 'Non';
                        if (String(this.apoData['CONF_OBL']).toLowerCase() === 'true') this.apoData['CONF_OBL'] = 'Oui';
                        else if (String(this.apoData['CONF_OBL']).toLowerCase() === 'false') this.apoData['CONF_OBL'] = 'Non';
                    }
                    this.buildTimeline();
                    this.fetchBackendPdf();
                    this.isLoading = false;
                },
                error: () => {

                    this.buildTimeline();
                    this.fetchBackendPdf();
                    this.isLoading = false;
                }
            });
        }, 1200);
    }

    private fetchBackendPdf(): void {
        this.projectsService.getDownloadUrl(this.dossierId, 'apo').subscribe({
            next: (res) => {
                if (res && res.url) {
                    this.backendPdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(res.url);
                }
            },
            error: (err) => {
                console.warn('Backend APO PDF not available, using fallback.', err);
            }
        });
    }



    private buildTimeline(): void {
        this.projectsService.getAuditHistory(this.dossierId).subscribe(audits => {
            let data = audits;
            if (!data || data.length === 0) {
                // Pas de données d'audit
                this.timelineEvents = [];
                return;
            }

            // Map AuditEntry[] to timelineEvents[]
            this.timelineEvents = data.map((entry, index) => {
                let icon = 'pi-circle-fill';
                let color = 'gray';
                let description = '';

                // Parsing du JSON detail
                let detailObj: any = {};
                if (entry.detail) {
                    try { detailObj = JSON.parse(entry.detail); } catch(e) {}
                }

                if (entry.action === 'UPLOADED') { icon = 'pi-cloud-upload'; color = 'blue'; description = `Fichier déposé : ${detailObj.fileName || 'N/A'}`; }
                else if (entry.action.includes('PARSING')) { icon = 'pi-sparkles'; color = 'orange'; description = `Extraction IA terminée (Score: ${detailObj.confianceGlobale || 'N/A'})`; }
                else if (entry.action === 'FIELD_CORRECTED') { icon = 'pi-user-edit'; color = 'indigo'; description = `Champ corrigé : ${detailObj.field}`; }
                else if (entry.action === 'VALIDATOR_APPROVED') { icon = 'pi-check-circle'; color = 'green'; description = `Approuvé par ${detailObj.role || 'Validateur'}`; }
                else if (entry.action === 'INDEXED') { icon = 'pi-server'; color = 'green'; description = 'Sauvegarde et génération du Template APO en DB.'; }

                return {
                    status: entry.action,
                    date: new Date(entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                    icon,
                    color,
                    description: `${description} — Acteur: ${entry.acteur || 'N/A'}`,
                    isLast: index === data.length - 1
                };
            });
        });
    }

    toggleAuditLog(): void {
        this.showAuditLog = !this.showAuditLog;
    }

    downloadApo(): void {
        this.projectsService.getDownloadUrl(this.dossierId, 'apo').subscribe({
            next: (res) => {
                if (res && res.url) {
                    window.open(res.url, '_blank');
                    this.messageService.add({ severity: 'success', summary: 'Téléchargement', detail: `Téléchargement de ${res.filename} lancé.` });
                }
            },
            error: (err) => {
                console.error(err);
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de télécharger le document APO.' });
            }
        });
    }
}
