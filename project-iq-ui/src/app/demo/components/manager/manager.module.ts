import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ManagerRoutingModule } from './manager-routing.module';
import { ManagerDashboardComponent } from './manager-dashboard/manager-dashboard.component';
import { ManagerNoGoComponent } from './manager-no-go/manager-no-go.component';
import { ManagerForcageComponent } from './manager-forcage/manager-forcage.component';
import { ManagerValidationsComponent } from './manager-validations/manager-validations.component';
import { ManagerAuditComponent } from './manager-audit/manager-audit.component';
import { ManagerPacksSuiviComponent } from './manager-packs-suivi/manager-packs-suivi.component';
import { ManagerHistoriquePacksComponent } from './manager-historique-packs/manager-historique-packs.component';
import { ManagerHistoriqueNogoComponent } from './manager-historique-nogo/manager-historique-nogo.component';
import { ManagerHistoriqueDecisionsComponent } from './manager-historique-decisions/manager-historique-decisions.component';

// PrimeNG modules...
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { BadgeModule } from 'primeng/badge';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TimelineModule } from 'primeng/timeline';
import { ChartModule } from 'primeng/chart';
import { KnobModule } from 'primeng/knob';
import { ProgressBarModule } from 'primeng/progressbar';
import { SkeletonModule } from 'primeng/skeleton';
import { MenuModule } from 'primeng/menu';

@NgModule({
    declarations: [
        ManagerDashboardComponent,
        ManagerNoGoComponent,
        ManagerForcageComponent,
        ManagerValidationsComponent,
        ManagerAuditComponent,
        ManagerPacksSuiviComponent,
        ManagerHistoriquePacksComponent,
        ManagerHistoriqueNogoComponent,
        ManagerHistoriqueDecisionsComponent
    ],
    imports: [
        CommonModule,
        FormsModule,
        ManagerRoutingModule,
        CardModule,
        ButtonModule,
        TableModule,
        ToastModule,
        DialogModule,
        DropdownModule,
        TagModule,
        InputTextModule,
        ProgressSpinnerModule,
        BadgeModule,
        InputTextareaModule,
        TimelineModule,
        ChartModule,
        KnobModule,
        ProgressBarModule,
        SkeletonModule,
        MenuModule
    ]
})
export class ManagerModule { }
