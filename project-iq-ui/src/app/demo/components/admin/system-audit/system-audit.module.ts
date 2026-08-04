import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SystemAuditRoutingModule } from './system-audit-routing.module';
import { SystemAuditComponent } from './system-audit.component';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { CalendarModule } from 'primeng/calendar';

@NgModule({
  declarations: [
    SystemAuditComponent
  ],
  imports: [
    CommonModule,
    SystemAuditRoutingModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    TagModule,
    ToastModule,
    CalendarModule
  ]
})
export class SystemAuditModule { }
