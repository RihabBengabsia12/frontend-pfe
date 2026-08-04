import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthRoutingModule } from './auth-routing.module';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { RippleModule } from 'primeng/ripple';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        ToastModule,
        AuthRoutingModule,
        InputTextModule,
        ButtonModule,
        PasswordModule,
        CheckboxModule,
        DialogModule,
        RippleModule
    ],
    providers: [MessageService]
})
export class AuthModule { }
