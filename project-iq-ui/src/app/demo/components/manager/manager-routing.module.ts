import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ManagerDashboardComponent } from './manager-dashboard/manager-dashboard.component';
import { ManagerNoGoComponent } from './manager-no-go/manager-no-go.component';
import { ManagerForcageComponent } from './manager-forcage/manager-forcage.component';
import { ManagerValidationsComponent } from './manager-validations/manager-validations.component';
import { ManagerAuditComponent } from './manager-audit/manager-audit.component';
import { ManagerPacksSuiviComponent } from './manager-packs-suivi/manager-packs-suivi.component';
import { ManagerHistoriquePacksComponent } from './manager-historique-packs/manager-historique-packs.component';
import { ManagerHistoriqueNogoComponent } from './manager-historique-nogo/manager-historique-nogo.component';
import { ManagerHistoriqueDecisionsComponent } from './manager-historique-decisions/manager-historique-decisions.component';

const routes: Routes = [
    // ESPACE SUPERVISION
    { path: 'dashboard', component: ManagerDashboardComponent },
    { path: 'packs-suivi', component: ManagerPacksSuiviComponent },
    { path: 'nogo-consultation', component: ManagerNoGoComponent }, // Reuse
    { path: 'audit-consultation', component: ManagerAuditComponent }, // Reuse
    
    // ESPACE DECISION
    { path: 'decisions-finales', component: ManagerValidationsComponent },
    { path: 'decisions-nogo', component: ManagerForcageComponent },
    { path: 'rapports-audit', component: ManagerAuditComponent }, // Reuse or create specific
    { path: 'historique-packs', component: ManagerHistoriquePacksComponent },
    { path: 'historique-nogo', component: ManagerHistoriqueNogoComponent },
    { path: 'historique-decisions', component: ManagerHistoriqueDecisionsComponent },
    
    { path: '**', redirectTo: 'dashboard' }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class ManagerRoutingModule { }
