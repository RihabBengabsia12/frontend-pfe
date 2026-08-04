import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/demo/service/auth.service';

@Component({
    selector: 'app-pending',
    templateUrl: './pending.component.html'
})
export class PendingComponent {
    constructor(private router: Router, private authService: AuthService) { }

    logout() {
        this.authService.logout();
        this.router.navigate(['/auth/login']);
    }
}
