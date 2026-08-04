import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ValidationsComponent } from './validations/validations.component';
import { UsersComponent } from './users/users.component';
import { AuditComponent } from './audit/audit.component';
import { HealthComponent } from './health/health.component';
import { ProfileComponent } from './profile/profile.component';
import { RolesComponent } from './roles/roles.component';
import { ScoringConfigPageComponent } from './scoring-config-page/scoring-config-page.component';
import { MatchingConfigPageComponent } from './matching-config-page/matching-config-page.component';
import { DlpConfigComponent } from './dlp-config/dlp-config.component';
import { ReferentielPageComponent } from './referentiel/referentiel-page.component';
import { DelegationsPageComponent } from './delegations/delegations-page.component';

@NgModule({
    imports: [RouterModule.forChild([
        { path: 'validations', component: ValidationsComponent },
        { path: 'users',       component: UsersComponent },
        { path: 'audit',       component: AuditComponent },
        { path: 'health',      component: HealthComponent },
        { path: 'profile',     component: ProfileComponent },
        { path: 'roles',       component: RolesComponent },
        { path: 'scoring-config', component: ScoringConfigPageComponent },
        { path: 'matching-config', component: MatchingConfigPageComponent },
        { path: 'dlp-config',  component: DlpConfigComponent },
        { path: 'referentiel', component: ReferentielPageComponent },
        { path: 'delegations', component: DelegationsPageComponent },
        { path: 'system-audit', loadChildren: () => import('./system-audit/system-audit.module').then(m => m.SystemAuditModule) },
        { path: '',            redirectTo: 'validations', pathMatch: 'full' }
    ])],
    exports: [RouterModule]
})
export class AdminRoutingModule { }
