import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EmailValidationComponent } from './email-validation.component';

@NgModule({
    declarations: [
        EmailValidationComponent
    ],
    imports: [
        CommonModule,
        RouterModule
    ],
    exports: [
        EmailValidationComponent
    ]
})
export class EmailValidationModule { }
