import { OnInit } from '@angular/core';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LayoutService } from './service/app.layout.service';
import { AuthService } from '../demo/service/auth.service';
import { AdminService } from '../demo/service/admin.service';
import { DelegationService } from '../demo/service/delegation.service';
import { FeatureFlagService } from '../demo/service/feature-flag.service';
import { catchError, of } from 'rxjs';

@Component({
    selector: 'app-menu',
    templateUrl: './app.menu.component.html'
})
export class AppMenuComponent implements OnInit {

    model: any[] = [];
    roleUpper = '';
    firstName = '';

    constructor(
        public layoutService: LayoutService,
        private authService: AuthService,
        private adminService: AdminService,
        private delegationService: DelegationService,
        private featureFlagService: FeatureFlagService,
        private router: Router
    ) { }

    ngOnInit() {
        const role = sessionStorage.getItem('userRole') || 'GUEST';
        const roleUpper = role.toUpperCase();
        this.roleUpper = roleUpper;

        const fullName = sessionStorage.getItem('userFullName') || sessionStorage.getItem('userName') || '';
        const email = sessionStorage.getItem('userEmail') || '';
        const fromName = fullName.trim().split(/\s+/)[0];
        const fromEmail = email.split('@')[0];
        this.firstName = fromName || fromEmail || 'Rihab';

        const lastProjectId = sessionStorage.getItem('lastProjectId') || localStorage.getItem('lastProjectId') || 'TEST-PROJECT-001';

        if (roleUpper === 'ADMIN') {
            this.model = [
                {
                    label: 'SUPERVISION GLOBALE',
                    items: [
                        { label: 'Dashboard Système', icon: 'pi pi-fw pi-chart-bar', routerLink: ['/dashboard'] },
                        { label: 'Santé des Microservices', icon: 'pi pi-fw pi-server', routerLink: ['/admin/health'] }
                    ]
                },
                { separator: true },
                {
                    label: 'PARAMÈTRES SYSTÈME',
                    items: [
                        { label: 'Configuration du Scoring', icon: 'pi pi-fw pi-sliders-h', routerLink: ['/admin/scoring-config'] },
                        { label: 'Configuration du Matching', icon: 'pi pi-fw pi-sitemap', routerLink: ['/admin/matching-config'] },
                        { label: 'Configuration Sécurité (DLP)', icon: 'pi pi-fw pi-shield', routerLink: ['/admin/dlp-config'] },
                        { label: 'Configuration IA Globale', icon: 'pi pi-fw pi-sliders-v', routerLink: ['/analyst/config-ia'] }
                    ]
                },
                { separator: true },
                {
                    label: 'GOUVERNANCE',
                    items: [
                        { label: 'Validation des Inscriptions', icon: 'pi pi-fw pi-user-edit', routerLink: ['/admin/validations'] },
                        { label: 'Journal d\'Audit (Accès)', icon: 'pi pi-fw pi-shield', routerLink: ['/admin/audit'] },
                        { label: 'Journal d\'Audit (Système)', icon: 'pi pi-fw pi-server', routerLink: ['/admin/system-audit'] },
                        { label: 'Annuaire des Utilisateurs', icon: 'pi pi-fw pi-users', routerLink: ['/admin/users'] },
                        { label: 'Rôles & Permissions', icon: 'pi pi-fw pi-key', routerLink: ['/admin/roles'] },
                        { label: 'Délégations (Décisions)', icon: 'pi pi-fw pi-sitemap', routerLink: ['/admin/delegations'] }
                    ]
                },
                { separator: true },
                {
                    label: 'MON COMPTE',
                    items: [
                        { label: 'Paramètres du Profil', icon: 'pi pi-fw pi-user', routerLink: ['/admin/profile'] }
                    ]
                },
                { separator: true },
                {
                    label: 'RÉFÉRENTIEL MÉTIER',
                    items: [
                        { label: 'Données Société', icon: 'pi pi-fw pi-database', routerLink: ['/admin/referentiel'] }
                    ]
                }
            ];
        } else if (roleUpper === 'ANALYST') {
            // Rendu synchrone par défaut (évite le bug du menu vide au chargement)
            this.model = [
                {
                    label: "📊 ESPACE ANALYSTE",
                    items: [
                        { label: 'Tableau de bord (Vue générale)', icon: 'pi pi-fw pi-chart-bar', routerLink: ['/analyst/dashboard'] },
                        {
                            label: 'Lancer une Analyse',
                            icon: 'pi pi-fw pi-play',
                            items: [
                                { label: '1. Dépôt du dossier', icon: 'pi pi-fw pi-upload', routerLink: ['/dossiers/nouveau'] },
                                { label: '2. Extraction approfondie', icon: 'pi pi-fw pi-file-edit', routerLink: ['/dossiers/' + lastProjectId + '/analyse'] },
                                { label: '3. Matching', icon: 'pi pi-fw pi-percentage', routerLink: ['/dossiers/' + lastProjectId + '/matching'] },
                                { label: '4. Finalisation', icon: 'pi pi-fw pi-check-circle', routerLink: ['/dossiers/' + lastProjectId + '/rapport-final'] }
                            ]
                        }
                    ]
                },
                { separator: true },
                {
                    label: "📄 LIVRABLES & HISTORIQUE",
                    items: [
                        { label: 'Dossiers importés (Historique)', icon: 'pi pi-fw pi-history', routerLink: ['/dossiers'] },
                        { label: 'Rapports générés', icon: 'pi pi-fw pi-file-pdf', routerLink: ['/analyst/rapports'] },
                        { label: 'Méthodologies', icon: 'pi pi-fw pi-book', routerLink: ['/analyst/methodologies'] },
                        { label: 'Rapports No-Go', icon: 'pi pi-fw pi-ban', routerLink: ['/analyst/nogo-reports'] },
                        { label: 'APO Finales', icon: 'pi pi-fw pi-file-word', routerLink: ['/analyst/apos'] }
                    ]
                },
                {
                    label: "⚙️ LOGS & IA",
                    items: [
                        { label: 'Analyses IA (Logs)', icon: 'pi pi-fw pi-align-left', routerLink: ['/analyst/analyses-logs'] }
                    ]
                }
            ];

            this.featureFlagService.initFromCache();
            this.featureFlagService.flags$.subscribe(features => {
                let dynamicModel = [];
                
                let isAnalystLocked = features['ESPACE_ANALYSTE'] === false;
                dynamicModel.push({
                    label: "📊 ESPACE ANALYSTE",
                    disabled: isAnalystLocked,
                    styleClass: isAnalystLocked ? 'menu-locked' : '',
                    items: [
                        { label: 'Tableau de bord (Vue générale)', icon: 'pi pi-fw pi-chart-bar', routerLink: ['/analyst/dashboard'], disabled: isAnalystLocked },
                        {
                            label: 'Lancer une Analyse',
                            icon: 'pi pi-fw pi-play',
                            styleClass: 'analysis-flow-menu',
                            disabled: isAnalystLocked,
                            items: [
                                { label: '1. Dépôt du dossier', icon: 'pi pi-fw pi-upload', routerLink: ['/dossiers/nouveau'], styleClass: 'analysis-flow-step', disabled: isAnalystLocked },
                                { label: '2. Extraction approfondie', icon: 'pi pi-fw pi-file-edit', routerLink: ['/dossiers/' + lastProjectId + '/analyse'], styleClass: 'analysis-flow-step', disabled: isAnalystLocked },
                                { label: '3. Matching', icon: 'pi pi-fw pi-percentage', routerLink: ['/dossiers/' + lastProjectId + '/matching'], styleClass: 'analysis-flow-step', disabled: isAnalystLocked },
                                { label: '4. Finalisation', icon: 'pi pi-fw pi-check-circle', routerLink: ['/dossiers/' + lastProjectId + '/rapport-final'], styleClass: 'analysis-flow-step', disabled: isAnalystLocked }
                            ]
                        }
                    ]
                });
                dynamicModel.push({ separator: true });

                let isLivrablesLocked = features['LIVRABLES'] === false;
                dynamicModel.push({
                    label: "📄 LIVRABLES & HISTORIQUE",
                    disabled: isLivrablesLocked,
                    styleClass: isLivrablesLocked ? 'menu-locked' : '',
                    items: [
                        { label: 'Dossiers importés (Historique)', icon: 'pi pi-fw pi-history', routerLink: ['/dossiers'], disabled: isLivrablesLocked },
                        { label: 'Rapports générés', icon: 'pi pi-fw pi-file-pdf', routerLink: ['/analyst/rapports'], disabled: isLivrablesLocked },
                        { label: 'Méthodologies', icon: 'pi pi-fw pi-book', routerLink: ['/analyst/methodologies'], disabled: isLivrablesLocked },
                        { label: 'Rapports No-Go', icon: 'pi pi-fw pi-ban', routerLink: ['/analyst/nogo-reports'], disabled: isLivrablesLocked },
                        { label: 'APO Finales', icon: 'pi pi-fw pi-file-word', routerLink: ['/analyst/apos'], disabled: isLivrablesLocked }
                    ]
                });

                let isLogsLocked = features['LOGS_IA'] === false;
                dynamicModel.push({
                    label: "⚙️ LOGS & IA",
                    disabled: isLogsLocked,
                    styleClass: isLogsLocked ? 'menu-locked' : '',
                    items: [
                        { label: 'Analyses IA (Logs)', icon: 'pi pi-fw pi-align-left', routerLink: ['/analyst/analyses-logs'], disabled: isLogsLocked }
                    ]
                });
                
                this.model = dynamicModel;
                
                this.model.push(
                    { separator: true },
                    {
                        label: 'SESSION',
                        items: [{
                            label: 'Déconnexion',
                            icon: 'pi pi-fw pi-sign-out',
                            command: () => {
                                this.authService.logout();
                                this.router.navigate(['/landing']);
                            }
                        }]
                    }
                );
            });
            return;
        } else if (roleUpper === 'MANAGER') {
            const FALLBACK_VIPS = ['do@t2i.tn', 'do@st2i.tn', 'dda@st2i.tn', 'dga@st2i.tn', 'pdg@st2i.tn'];
            const isHardcodedVip = FALLBACK_VIPS.includes(email.toLowerCase());

            this.delegationService.getAllDelegations().pipe(catchError(() => of([]))).subscribe({
                next: (delegations) => {
                    const vipEmails = delegations.map(d => d.email?.toLowerCase());
                    const isVip = vipEmails.includes(email.toLowerCase()) || isHardcodedVip;

                    this.adminService.getUserFeatures(email).pipe(catchError(() => of({}))).subscribe({
                next: (features) => {
                    this.model = [];
                    
                    // Seuls les VIPs voient l'Espace Décision (sauf restriction explicite)
                    if (isVip && features['ESPACE_DECISION'] !== false) {
                        this.model.push({
                            label: '⚖️ ESPACE DÉCISION',
                            items: [
                                { label: 'Décision Finale (Go / No-Go)', icon: 'pi pi-fw pi-check-circle', routerLink: ['/manager/decisions-finales'] },
                                { label: 'Décision Rapports No-Go', icon: 'pi pi-fw pi-ban', routerLink: ['/manager/decisions-nogo'] },
                                { label: 'Rapports d\'Audit', icon: 'pi pi-fw pi-file-pdf', routerLink: ['/manager/rapports-audit'] },
                                { label: 'Historique des Packs', icon: 'pi pi-fw pi-history', routerLink: ['/manager/historique-packs'] },
                                { label: 'Historique des No-Go', icon: 'pi pi-fw pi-folder-open', routerLink: ['/manager/historique-nogo'] },
                                { label: 'Historique des Décisions', icon: 'pi pi-fw pi-list', routerLink: ['/manager/historique-decisions'] }
                            ]
                        });
                        this.model.push({ separator: true });
                    }

                    // Les Managers normaux voient l'Espace Supervision (sauf restriction explicite)
                    if (!isVip && features['ESPACE_SUPERVISION'] !== false) {
                        this.model.push({
                            label: '📊 ESPACE SUPERVISION',
                            items: [
                                { label: 'Tableau de bord global', icon: 'pi pi-fw pi-chart-bar', routerLink: ['/manager/dashboard'] },
                                { label: 'Suivi Global des Packs', icon: 'pi pi-fw pi-box', routerLink: ['/manager/packs-suivi'] },
                                { label: 'Rapports No-Go (Consultation)', icon: 'pi pi-fw pi-ban', routerLink: ['/manager/nogo-consultation'] },
                                { label: 'Rapports d\'Audit (Consultation)', icon: 'pi pi-fw pi-eye', routerLink: ['/manager/audit-consultation'] }
                            ]
                        });
                    }
                    
                    this.addCommonItems();
                },
                error: (err) => {
                    console.error("Impossible de charger les droits spécifiques", err);
                }
            });
            // Closing for delegationService.subscribe
            }
            });
            // Early return because addCommonItems is called inside subscribe
            return;
        } else {
            // GUEST or USER
            this.model = [
                {
                    label: 'ACCÈS',
                    items: [
                        { label: 'Dashboard', icon: 'pi pi-fw pi-home', routerLink: ['/dashboard'] }
                    ]
                }
            ];
        }

        // Common items for other roles (ADMIN, MANAGER, GUEST) are handled below
        this.addCommonItems();
    }

    private addCommonItems() {
        this.model.push(
            { separator: true },
            {
                label: 'SESSION',
                items: [
                    {
                        label: 'Déconnexion',
                        icon: 'pi pi-fw pi-sign-out',
                        command: () => {
                            this.authService.logout();
                            this.router.navigate(['/landing']);
                        }
                    }
                ]
            }
        );
    }
}
