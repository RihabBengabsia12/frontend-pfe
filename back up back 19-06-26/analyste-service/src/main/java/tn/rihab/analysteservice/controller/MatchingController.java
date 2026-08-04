package tn.rihab.analysteservice.controller;

import tn.rihab.analysteservice.client.ProjectServiceClient;
import tn.rihab.analysteservice.matching.MatchingEngine;
import tn.rihab.analysteservice.model.MatchingResult;
import tn.rihab.analysteservice.repository.MatchingResultRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Endpoints Phase 3 — Matching avec le référentiel société.
 * Base URL : /api/matching
 *
 * POST /api/matching/{id}/run     Lance le matching complet
 * GET  /api/matching/{id}/result  Retourne le résultat du matching
 * GET  /api/matching/{id}/matrix  Retourne la matrice de différenciation
 */
@RestController
@RequestMapping("/api/matching")
@RequiredArgsConstructor
@Slf4j
public class MatchingController {

    private final MatchingEngine           matchingEngine;
    private final MatchingResultRepository matchingRepo;
    private final ProjectServiceClient     projectClient;

    // ── POST /api/matching/{id}/run ───────────────────────────────────────────

    /**
     * Lance le matching complet Phase 3 pour un dossier.
     *
     * Étapes exécutées :
     *  1. ia-service extrait les exigences structurées de la DP (refs, qualifs, experts)
     *  2. CompetencesMatcher  → tauxCouvertureCompetences (0.0–1.0)
     *  3. ReferencesMatcher   → GAP_REFS + références disponibles Egis
     *  4. ExpertsMatcher      → tauxCouvertureExperts + experts identifiés
     *  5. ClientMatcher       → RELATION_CLIENT niveau 1-5
     *  6. ia-service génère   → matrice de différenciation (critère | position | argument)
     *
     * En fonctionnement normal, déclenché automatiquement par AnalyseDeepService.
     * Cet endpoint permet un re-déclenchement manuel depuis Angular.
     *
     * @return MatchingResult complet persisté
     */
    @PostMapping("/{id}/run")
    public ResponseEntity<MatchingResult> runMatching(@PathVariable UUID id) {
        log.info("[Matching] Déclenchement Phase 3 — dossier {}", id);

        var dossier      = projectClient.getDossier(id);
        var documentText = projectClient.getDocumentText(id);

        MatchingResult result = matchingEngine.runMatching(dossier, documentText);

        log.info("[Matching] Dossier {} — compétences={:.0f}% experts={:.0f}% client=niv{}",
                id,
                result.getTauxCouvertureCompetences() != null ? result.getTauxCouvertureCompetences() * 100 : 0,
                result.getTauxCouvertureExperts()     != null ? result.getTauxCouvertureExperts()     * 100 : 0,
                result.getRelationClientNiveau());

        return ResponseEntity.ok(result);
    }

    // ── GET /api/matching/{id}/result ─────────────────────────────────────────

    /**
     * Retourne le résultat complet du matching.
     * Utilisé par la page matching Angular (onglets compétences, références, experts).
     *
     * Contient :
     *  - tauxCouvertureCompetences / tauxCouvertureExperts
     *  - refsExigees (JSON) / gapRefs (JSON)
     *  - expertsRequis (JSON) / expertsDetail (JSON)
     *  - relationClientNiveau / relationClientNbMissions
     *  - secteurAo / alignementStrategique
     *  - qualifsExigees / gapQualifs
     */
    @GetMapping("/{id}/result")
    public ResponseEntity<MatchingResult> getResult(@PathVariable UUID id) {
        return ResponseEntity.ok(
                matchingRepo.findByDossierId(id)
                        .orElseThrow(() -> new IllegalArgumentException(
                                "Matching non disponible pour le dossier : " + id +
                                        " — lancer POST /api/matching/" + id + "/run d'abord")));
    }

    // ── GET /api/matching/{id}/matrix ─────────────────────────────────────────

    /**
     * Retourne la matrice de différenciation désérialisée.
     * Utilisée par la page matrice Angular pour affichage tabulaire.
     *
     * Réponse : liste de lignes [{critere, positionEgis, argumentGap}]
     * positionEgis ∈ { COUVERT, PARTIELLEMENT, NON_COUVERT, VIA_PARTENAIRE }
     *
     * L'analyste peut modifier chaque ligne directement dans l'interface.
     */
    @GetMapping("/{id}/matrix")
    public ResponseEntity<Map<String, Object>> getMatrix(@PathVariable UUID id) {
        MatchingResult matching = matchingRepo.findByDossierId(id)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Matching non disponible pour le dossier : " + id));

        // Désérialiser le JSON de la matrice en liste pour Angular
        String matriceJson = matching.getMatriceDiff();

        return ResponseEntity.ok(Map.of(
                "dossierId",               id,
                "matriceDiff",             matriceJson != null ? matriceJson : "[]",
                "tauxCouvertureCompetences", matching.getTauxCouvertureCompetences() != null
                        ? matching.getTauxCouvertureCompetences() : 0.0,
                "tauxCouvertureExperts",     matching.getTauxCouvertureExperts() != null
                        ? matching.getTauxCouvertureExperts() : 0.0,
                "relationClientNiveau",      matching.getRelationClientNiveau() != null
                        ? matching.getRelationClientNiveau() : 1,
                "alignementStrategique",     matching.getAlignementStrategique() != null
                        ? matching.getAlignementStrategique() : "Non évalué",
                "secteurAo",                 matching.getSecteurAo() != null
                        ? matching.getSecteurAo() : "",
                "gapRefs",                   matching.getGapRefs() != null
                        ? matching.getGapRefs() : "[]",
                "gapQualifs",               matching.getGapQualifs() != null
                        ? matching.getGapQualifs() : "[]"
        ));
    }
}