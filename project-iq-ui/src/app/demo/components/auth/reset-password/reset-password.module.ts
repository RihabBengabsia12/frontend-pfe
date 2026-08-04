import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ResetPasswordRoutingModule } from './reset-password-routing.module';
import { ResetPasswordComponent } from './reset-password.component';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { RippleModule } from 'primeng/ripple';
import { ProgressBarModule } from 'primeng/progressbar';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        ResetPasswordRoutingModule,
        ButtonModule,
        InputTextModule,
        PasswordModule,
        ToastModule,
        RippleModule,
        ProgressBarModule
    ],
    declarations: [ResetPasswordComponent]
})
export class ResetPasswordModule { }
