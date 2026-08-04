import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PendingRoutingModule } from './pending-routing.module';
import { PendingComponent } from './pending.component';
import { ButtonModule } from 'primeng/button';

@NgModule({
    imports: [
        CommonModule,
        PendingRoutingModule,
        ButtonModule
    ],
    declarations: [PendingComponent]
})
export class PendingModule { }
