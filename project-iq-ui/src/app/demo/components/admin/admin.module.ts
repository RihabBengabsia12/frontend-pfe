import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AdminRoutingModule } from './admin-routing.module';

import { TableModule }         from 'primeng/table';
import { ButtonModule }        from 'primeng/button';
import { TagModule }           from 'primeng/tag';
import { DropdownModule }      from 'primeng/dropdown';
import { ToastModule }         from 'primeng/toast';
import { DialogModule }        from 'primeng/dialog';
import { CardModule }          from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextModule }     from 'primeng/inputtext';
import { InputNumberModule }   from 'primeng/inputnumber';
import { BadgeModule }         from 'primeng/badge';
import { RippleModule }        from 'primeng/ripple';
import { CalendarModule }      from 'primeng/calendar';
import { TabViewModule } from 'primeng/tabview';
import { TooltipModule }       from 'primeng/tooltip';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputSwitchModule } from 'primeng/inputswitch';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SkeletonModule } from 'primeng/skeleton';
import { TimelineModule } from 'primeng/timeline';
import { CheckboxModule } from 'primeng/checkbox';
import { MenuModule } from 'primeng/menu';
import { TieredMenuModule } from 'primeng/tieredmenu';
import { MessagesModule } from 'primeng/messages';
import { StyleClassModule } from 'primeng/styleclass';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { ToolbarModule } from 'primeng/toolbar';
import { ChipsModule } from 'primeng/chips';
import { LocalIpPipe }           from '../../pipe/ip.pipe';
import { MessageService, ConfirmationService } from 'primeng/api';

import { ValidationsComponent } from './validations/validations.component';
import { UsersComponent }       from './users/users.component';
import { AuditComponent }       from './audit/audit.component';
import { HealthComponent }      from './health/health.component';
import { ProfileComponent }     from './profile/profile.component';
import { RolesComponent }       from './roles/roles.component';
import { ScoringConfigPageComponent } from './scoring-config-page/scoring-config-page.component';
import { WeightSlidersComponent } from './scoring-config-page/weight-sliders/weight-sliders.component';
import { MatchingConfigPageComponent } from './matching-config-page/matching-config-page.component';
import { DlpConfigComponent } from './dlp-config/dlp-config.component';
import { ReferentielPageComponent } from './referentiel/referentiel-page.component';
import { DelegationsPageComponent } from './delegations/delegations-page.component';

@NgModule({
    declarations: [
        ValidationsComponent,
        UsersComponent,
        AuditComponent,
        HealthComponent,
        ProfileComponent,
        RolesComponent,
        LocalIpPipe,
        ScoringConfigPageComponent,
        WeightSlidersComponent,
        MatchingConfigPageComponent,
        DlpConfigComponent,
        ReferentielPageComponent,
        DelegationsPageComponent
    ],

    imports: [
        CommonModule,
        FormsModule,
        HttpClientModule,
        AdminRoutingModule,
        TableModule,
        ButtonModule,
        TagModule,
        DropdownModule,
        ToastModule,
        DialogModule,
        CardModule,
        ConfirmDialogModule,
        InputTextModule,
        BadgeModule,
        RippleModule,
        CalendarModule,
        InputNumberModule,
        TooltipModule,
        TabViewModule,
        InputTextareaModule,
        InputSwitchModule,
        ProgressSpinnerModule,
        SkeletonModule,
        TimelineModule,
        CheckboxModule,
        MenuModule,
        TieredMenuModule,
        MessagesModule,
        StyleClassModule,
        OverlayPanelModule,
        ToolbarModule,
        ChipsModule
    ],

    providers: [ConfirmationService]
})
export class AdminModule { }
