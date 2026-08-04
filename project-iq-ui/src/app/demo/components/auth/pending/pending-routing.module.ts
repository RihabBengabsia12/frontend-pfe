import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PendingComponent } from './pending.component';

@NgModule({
    imports: [RouterModule.forChild([
        { path: '', component: PendingComponent }
    ])],
    exports: [RouterModule]
})
export class PendingRoutingModule { }
