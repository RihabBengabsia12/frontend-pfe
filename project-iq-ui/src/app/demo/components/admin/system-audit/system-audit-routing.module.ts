import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SystemAuditComponent } from './system-audit.component';

const routes: Routes = [
    { path: '', component: SystemAuditComponent }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class SystemAuditRoutingModule { }
