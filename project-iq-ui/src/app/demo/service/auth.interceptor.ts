import { Injectable, Injector } from '@angular/core';
import {
    HttpInterceptor,
    HttpRequest,
    HttpHandler,
    HttpEvent,
    HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, take, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

    private isRefreshing = false;
    private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

    constructor(private router: Router, private injector: Injector) {}

    /**
     * Routes publiques qui ne doivent JAMAIS avoir de token Bearer
     * et qui ne doivent pas déclencher de logout en cas de 401
     */
    private isPublicRequest(url: string): boolean {
        const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/health', '/refresh'];
        return publicPaths.some(path => url.includes(path));
    }

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        const token = sessionStorage.getItem('accessToken');
        const isPublic = this.isPublicRequest(req.url);

        let authReq = req;
        if (token && !isPublic) {
            authReq = this.addToken(req, token);
        }

        return next.handle(authReq).pipe(
            catchError((error: HttpErrorResponse) => {
                // Certains microservices renvoient 403 pour un JWT expiré alors
                // que d'autres renvoient 401 : dans les deux cas on tente le
                // renouvellement du jeton avant de bloquer l'action utilisateur.
                if ((error.status === 401 || error.status === 403) && !isPublic) {
                    return this.handle401Error(authReq, next);
                }
                return throwError(() => error);
            })
        );
    }

    private addToken(request: HttpRequest<any>, token: string) {
        return request.clone({
            setHeaders: {
                'Authorization': `Bearer ${token}`
            }
        });
    }

    private handle401Error(request: HttpRequest<any>, next: HttpHandler) {
        if (!this.isRefreshing) {
            this.isRefreshing = true;
            this.refreshTokenSubject.next(null);

            const authService = this.injector.get(AuthService);

            return authService.refresh().pipe(
                switchMap((res: any) => {
                    this.isRefreshing = false;
                    this.refreshTokenSubject.next(res.accessToken);
                    return next.handle(this.addToken(request, res.accessToken));
                }),
                catchError((err) => {
                    this.isRefreshing = false;
                    sessionStorage.clear();
                    this.router.navigate(['/auth/login']);
                    return throwError(() => err);
                })
            );
        } else {
            return this.refreshTokenSubject.pipe(
                filter(token => token != null),
                take(1),
                switchMap(jwt => {
                    return next.handle(this.addToken(request, jwt));
                })
            );
        }
    }
}
