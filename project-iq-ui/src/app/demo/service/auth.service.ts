import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';

// ─── DTOs ──────────────────────────────────────────────────────────────────

export interface RegisterRequest {
    fullName: string;
    email: string;
    password: string;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    email: string;
    role?: string;
    roleCode?: string;
}

// GET /api/auth/me
export interface AccountResponse {
    id: string;
    email: string;
    role: string;
}

// PATCH /api/auth/me/password
export interface ChangePasswordRequest {
    oldPassword: string;
    newPassword: string;
}

// GET /api/auth/events
export interface AccessEvent {
    id: string;
    userId: string;
    emailAttempted: string;
    eventType: string;
    result: string;
    ipAddress?: string;
    userAgent?: string;
    occurredAt: string;
}

export interface SpringPage<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
}

// ─── Service ───────────────────────────────────────────────────────────────

@Injectable({
    providedIn: 'root'
})
export class AuthService {

    private API_URL = '/api/auth';

    constructor(private http: HttpClient) { }

    // ── POST /api/auth/register ────────────────────────────────
    register(registerData: RegisterRequest): Observable<string> {
        return this.http.post(`${this.API_URL}/register`, registerData, { responseType: 'text' });
    }

    // ── POST /api/auth/login ───────────────────────────────────
    login(loginData: LoginRequest): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${this.API_URL}/login`, loginData);
    }

    // ── POST /api/auth/refresh ─────────────────────────────────
    refresh(): Observable<LoginResponse> {
        const refreshToken = sessionStorage.getItem('refreshToken') || '';
        return this.http.post<LoginResponse>(`${this.API_URL}/refresh`, { refreshToken }).pipe(
            tap(res => this.setSession(res))
        );
    }

    // ── POST /api/auth/logout ──────────────────────────────────
    logout(): void {
        const refreshToken = sessionStorage.getItem('refreshToken');
        if (refreshToken) {
            this.http.post(`${this.API_URL}/logout`, { refreshToken }).subscribe({
                error: () => {}
            });
        }
        sessionStorage.clear();
    }

    // ── GET /api/auth/me ───────────────────────────────────────
    getMe(): Observable<AccountResponse> {
        return this.http.get<AccountResponse>(`${this.API_URL}/me`);
    }

    // ── PATCH /api/auth/me/password ────────────────────────────
    changePassword(req: ChangePasswordRequest): Observable<{ message: string }> {
        return this.http.post<{ message: string }>(`${this.API_URL}/change-password`, req);
    }

    // ── POST /api/auth/validate-dossier/{id} (ADMIN) ───────────
    validateDossier(id: string, role?: string): Observable<{ message: string }> {
        // On envoie le rôle par tous les moyens (Params + Body) pour forcer la prise en compte au backend
        let url = `${this.API_URL}/validate-dossier/${id}`;
        if (role) url += `?role=${role}`;
        
        return this.http.post<{ message: string }>(url, { 
            role: role,
            roleCode: role 
        });
    }

    // ── PATCH /api/auth/accounts/{id}/unlock (Legacy) ──────────
    unlockAccount(id: string, role?: string): Observable<{ message: string }> {
        const val = role || 'USER';
        return this.http.patch<{ message: string }>(`${this.API_URL}/accounts/${id}/unlock`, { 
            role: val,
            roleCode: val 
        });
    }

    // ── POST /api/auth/activate-account/{id} (Final activation & Email) ───
    validateUser(id: string, role: string): Observable<{ message: string }> {
        const finalRole = role && role !== 'null' ? role : 'USER';
        return this.http.post<{ message: string }>(`${this.API_URL}/activate-account/${id}`, { role: finalRole });
    }

    // ── PATCH /api/auth/accounts/{id}/reset-password (ADMIN) ──
    resetPassword(id: string, newPassword: string): Observable<{ message: string }> {
        return this.http.patch<{ message: string }>(
            `${this.API_URL}/accounts/${id}/reset-password`, { newPassword }
        );
    }

    // ── PUT /api/auth/reject/{id} (ADMIN) ──────────────────────
    rejectAccount(id: string, reason: string): Observable<{ message: string }> {
        return this.http.put<{ message: string }>(`${this.API_URL}/reject/${id}`, { reason });
    }

    // ── GET /api/auth/events (ADMIN) ───────────────────────────
    getEvents(filters: {
        email?: string;
        type?: string;
        page?: number;
        size?: number;
    }): Observable<SpringPage<AccessEvent>> {
        let params = new HttpParams()
            .set('page', filters.page ?? 0)
            .set('size', filters.size ?? 20);
        if (filters.email) params = params.set('email', filters.email);
        if (filters.type)  params = params.set('type', filters.type);
        return this.http.get<SpringPage<AccessEvent>>(`${this.API_URL}/events`, { params });
    }

    // ── POST /api/auth/forgot-password ────────────────────────
    forgotPassword(email: string): Observable<{ message: string }> {
        return this.http.post<{ message: string }>(`${this.API_URL}/forgot-password`, { email });
    }

    // ── POST /api/auth/reset-password ─────────────────────────
    resetPasswordPublic(token: string, newPassword: string): Observable<{ message: string }> {
        return this.http.post<{ message: string }>(`${this.API_URL}/reset-password`, { token, newPassword });
    }

    // ── GET /api/auth/health ───────────────────────────────────
    getAuthHealth(): Observable<{ status: string; service: string }> {
        return this.http.get<{ status: string; service: string }>(`${this.API_URL}/health`);
    }

    // ── GET /api/auth/accounts (ADMIN - liste tous les comptes inscrits) ──
    getAccounts(page = 0, size = 1000): Observable<any> {
        const params = new HttpParams()
            .set('page', page)
            .set('size', size);
        return this.http.get<any>(`${this.API_URL}/accounts`, { params });
    }

    // ─── Utilitaires session ───────────────────────────────────
    setSession(authResult: LoginResponse): void {
        sessionStorage.setItem('accessToken', authResult.accessToken);
        sessionStorage.setItem('refreshToken', authResult.refreshToken);
        sessionStorage.setItem('userEmail', authResult.email);
        const finalRole = authResult.roleCode || authResult.role || 'GUEST';
        sessionStorage.setItem('userRole', finalRole);
    }

    isLoggedIn(): boolean {
        return !!sessionStorage.getItem('accessToken');
    }

    getToken(): string | null {
        return sessionStorage.getItem('accessToken');
    }
}
