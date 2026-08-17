import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

// ── Types used by score-breakdown sub-component ───────────────────────────────
export interface ScoreBreakdownAxis {
    name: string;
    label: string;
    score: number;
    weight: number;
}

export interface ImpactFactor {
    positive: string;
    negative: string;
}

// ── Backend response types ────────────────────────────────────────────────────
export interface PwinScore {
    dossierId?: string;
    scoreGlobal: number;
    decisionAuto: 'GO' | 'GO_CONDITIONNEL' | 'MANUAL' | 'NO_GO';
    risqueRedhibitoire?: boolean;
    risqueRedhibitoireChamp?: string;
    motifNogo?: string;
    recommendation?: string;
    // 5-axis breakdown (may be present depending on backend version)
    scoreA?: number;
    scoreB?: number;
    scoreC?: number;
    scoreD?: number;
    scoreE?: number;
    forceGo?: boolean;
    forceGoType?: string;
    forceGoBy?: string;
}

export interface ScoringConfig {
    seuilNoGo: number;
    seuilGoConditionnel: number;
    seuilGoFort: number;
    poidsA_faisabilite: number;
    poidsB_rentabilite: number;
    poidsC_risques: number;
    poidsD_concurrence: number;
    poidsE_conformite: number;
    tjmMinEgis?: number;
    tjmMaxEgis?: number;
}

// ── UI display model (used by scoring-page template) ─────────────────────────
export interface ScoringResult {
    projectId: string;
    pwinScore: number;
    decision: 'GO' | 'NO-GO' | 'ORANGE' | 'MANUAL';
    recommendation: string;
    axes: ScoreBreakdownAxis[];
    impacts: ImpactFactor;
    goThreshold: number;
    nogoThreshold: number;
    risqueRedhibitoire?: boolean;
    risqueRedhibitoireChamp?: string;
    motifNogo?: string;
}

@Injectable({ providedIn: 'root' })
export class ScoringService {

    private readonly SCORING = '/api/scoring';
    private readonly CONFIG  = '/api/config/scoring';

    constructor(private http: HttpClient) {}

    // ── POST /api/scoring/{id}/calculate ──────────────────────────────────────
    calculate(dossierId: string): Observable<PwinScore> {
        return this.getResult(dossierId);
    }

    // ── GET /api/scoring/{id}/result ──────────────────────────────────────────
    getResult(dossierId: string): Observable<PwinScore> {
        return this.http.get<PwinScore>(`${this.SCORING}/${dossierId}/result`);
    }

    // ── POST /api/scoring/{id}/force-go ───────────────────────────────────────
    // justification: min 50 words enforced by backend
    // type: STRATEGIQUE | PARTENARIAT_A_CONSOLIDER | CLIENT_PRIORITAIRE | AUTRE
    forceGo(dossierId: string, justification: string, type: string, forcedBy: string): Observable<any> {
        const body = { justification, type, forcedBy };
        return this.http.post<any>(`${this.SCORING}/${dossierId}/force-go`, body);
    }

    // ── POST /api/scoring/{id}/confirm-nogo ───────────────────────────────────
    confirmNoGo(dossierId: string, commentaire?: string, analysteName?: string): Observable<any> {
        return this.http.post<any>(`${this.SCORING}/${dossierId}/confirm-nogo`, { commentaire, analysteName });
    }

    // ── GET /api/scoring/{id}/nogo-report ───────────────────────────────────
    getExistingNoGoReport(dossierId: string): Observable<any> {
        return this.http.get<any>(`${this.SCORING}/${dossierId}/nogo-report`);
    }

    // ── GET /api/config/scoring ───────────────────────────────────────────────
    getScoringConfig(): Observable<ScoringConfig> {
        return of({
            seuilGoFort: 70,
            seuilGoConditionnel: 40,
            seuilNoGo: 20,
            poidsA_faisabilite: 0.25,
            poidsB_rentabilite: 0.25,
            poidsC_risques: 0.25,
            poidsD_concurrence: 0.15,
            poidsE_conformite: 0.10
        }).pipe(delay(200));
    }

    // ── PUT /api/config/scoring ───────────────────────────────────────────────
    updateScoringConfig(config: ScoringConfig): Observable<ScoringConfig> {
        return this.http.put<ScoringConfig>(this.CONFIG, config);
    }

    // ── Transform PwinScore → ScoringResult (display model) ───────────────────
    toScoringResult(pwin: PwinScore, cfg?: ScoringConfig): ScoringResult {
        const goThreshold   = cfg?.seuilGoFort        ?? 70;
        const nogoThreshold = cfg?.seuilNoGo           ?? 20;
        const wA = (cfg?.poidsA_faisabilite ?? 0.25) * 100;
        const wB = (cfg?.poidsB_rentabilite ?? 0.25) * 100;
        const wC = (cfg?.poidsC_risques     ?? 0.25) * 100;
        const wD = (cfg?.poidsD_concurrence ?? 0.15) * 100;
        const wE = (cfg?.poidsE_conformite  ?? 0.10) * 100;

        const score = pwin.scoreGlobal ?? 0;
        const decision = this.mapDecision(pwin.decisionAuto, score, goThreshold, nogoThreshold);

        return {
            projectId:    pwin.dossierId || '',
            pwinScore:    score,
            decision,
            recommendation: pwin.recommendation || pwin.motifNogo || this.defaultRecommendation(decision),
            goThreshold,
            nogoThreshold,
            risqueRedhibitoire:      pwin.risqueRedhibitoire,
            risqueRedhibitoireChamp: this.formatMotif(pwin.risqueRedhibitoireChamp),
            motifNogo:               this.formatMotif(pwin.motifNogo),
            axes: [
                { name: 'A', label: 'Faisabilité technique',       score: Math.round((pwin.scoreA ?? 0) * 100), weight: wA },
                { name: 'B', label: 'Rentabilité financière',      score: Math.round((pwin.scoreB ?? 0) * 100), weight: wB },
                { name: 'C', label: 'Risques maîtrisés',           score: Math.round((pwin.scoreC ?? 0) * 100), weight: wC },
                { name: 'D', label: 'Concurrence & Client',        score: Math.round((pwin.scoreD ?? 0) * 100), weight: wD },
                { name: 'E', label: 'Conformité réglementaire',    score: Math.round((pwin.scoreE ?? 0) * 100), weight: wE }
            ],
            impacts: {
                positive: score >= goThreshold
                    ? `Score P-Win de ${score}% au-dessus du seuil GO (${goThreshold}%).`
                    : `Axe le plus fort : ${this.bestAxis(pwin)}.`,
                negative: pwin.risqueRedhibitoire
                    ? `⚠️ Risque rédhibitoire détecté : ${this.formatMotif(pwin.risqueRedhibitoireChamp)}.`
                    : this.formatMotif(pwin.motifNogo) || `Score P-Win insuffisant (${score}% < ${goThreshold}%).`
            }
        };
    }

    private formatMotif(motif?: string): string {
        if (!motif) return '';
        const dict: Record<string, string> = {
            'RISQUE_PAYS_SECURITE': 'Sécurité et Pays',
            'RISQUES_FINANCIERS': 'Risques Financiers',
            'PENALITES': 'Pénalités',
            'EXIGENCES_TDR_INACCEPTABLES': 'Exigences TdR',
            'GARANTIES_ASSURANCES_ELEVEES': 'Garanties et Assurances',
            'TAILLE_DISPERSION': 'Taille et Dispersion du projet',
            'FRAIS_DIVERS_ELEVES': 'Frais divers',
            'BUDGET_FAIBLE_HM_LIMITES': 'Budget faible',
            'PARTICIPATION_LOCALE_EXCESSIVE': 'Participation locale excessive',
            'FISCALITE_NON_MAITRISEE': 'Fiscalité non maîtrisée'
        };
        let formatted = motif;
        const match = motif.match(/\[\[(.*?)\]\]/);
        if (match && match[1]) {
            const key = match[1];
            const readable = dict[key] || key;
            formatted = motif.replace(`[[${key}]]`, `"${readable}"`);
        } else if (dict[motif]) {
            formatted = dict[motif];
        }
        return formatted;
    }

    private mapDecision(auto: string, score: number, goT: number, nogoT: number): 'GO' | 'NO-GO' | 'ORANGE' | 'MANUAL' {
        if (auto === 'GO')             return 'GO';
        if (auto === 'NO_GO')          return 'NO-GO';
        if (auto === 'GO_CONDITIONNEL') return 'ORANGE';
        if (auto === 'MANUAL')         return 'MANUAL';
        // fallback by score
        if (score >= goT)   return 'GO';
        if (score >= nogoT) return 'ORANGE';
        return 'NO-GO';
    }

    private bestAxis(pwin: PwinScore): string {
        const axes = [
            { n: 'Faisabilité',  v: pwin.scoreA ?? 0 },
            { n: 'Rentabilité',  v: pwin.scoreB ?? 0 },
            { n: 'Risques',      v: pwin.scoreC ?? 0 },
            { n: 'Concurrence',  v: pwin.scoreD ?? 0 },
            { n: 'Conformité',   v: pwin.scoreE ?? 0 }
        ];
        return axes.sort((a, b) => b.v - a.v)[0]?.n || '';
    }

    private defaultRecommendation(d: string): string {
        if (d === 'GO')     return 'Score P-Win satisfaisant — opportunité qualifiée pour la phase commerciale.';
        if (d === 'ORANGE') return 'Score P-Win conditionnel — intervention managériale recommandée.';
        return 'Score P-Win insuffisant — opportunité rejetée.';
    }
}
