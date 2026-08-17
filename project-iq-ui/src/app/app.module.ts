import { NgModule, ErrorHandler } from '@angular/core';
import { PathLocationStrategy, LocationStrategy } from '@angular/common';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { AppLayoutModule } from './layout/app.layout.module';
import { NotfoundComponent } from './demo/components/notfound/notfound.component';
import { AuthInterceptor } from './demo/service/auth.interceptor';
import { ProductService } from './demo/service/product.service';
import { CountryService } from './demo/service/country.service';
import { CustomerService } from './demo/service/customer.service';
import { EventService } from './demo/service/event.service';
import { IconService } from './demo/service/icon.service';
import { NodeService } from './demo/service/node.service';
import { PhotoService } from './demo/service/photo.service';
import { ResetPasswordModule } from './demo/components/auth/reset-password/reset-password.module';
import { EmailValidationModule } from './demo/components/auth/email-validation/email-validation.module';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

export class GlobalErrorHandler implements ErrorHandler {
    handleError(error: any) {
        console.error('Error from global error handler', error);
        alert('CRASH DÉTECTÉ: ' + (error.message || error.toString()));
    }
}

@NgModule({
    declarations: [
        AppComponent, NotfoundComponent
    ],
    imports: [
        AppRoutingModule,
        AppLayoutModule,
        ResetPasswordModule,
        EmailValidationModule,
        ToastModule
    ],
    providers: [{ provide: LocationStrategy, useClass: PathLocationStrategy },
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        { provide: ErrorHandler, useClass: GlobalErrorHandler },
        CountryService, CustomerService, EventService, IconService, NodeService,
        PhotoService, ProductService, MessageService],
    bootstrap: [AppComponent]
})
export class AppModule { }
