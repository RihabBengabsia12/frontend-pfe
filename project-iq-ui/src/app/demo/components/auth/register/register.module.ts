import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { RegisterRoutingModule } from './register-routing.module';
import { RegisterComponent } from './register.component';
import { ButtonModule } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { PasswordModule } from 'primeng/password';
import { InputTextModule } from 'primeng/inputtext';

@NgModule({
    imports: [
        CommonModule,
        HttpClientModule,
        RegisterRoutingModule,
        ButtonModule,
        InputTextModule,
        FormsModule,
        PasswordModule
    ],
    declarations: [RegisterComponent]
})
export class RegisterModule { }
