package tn.rihab.analysteservice.matching;

import com.fasterxml.jackson.databind.ObjectMapper;
import tn.rihab.analysteservice.dto.DossierDto;
import tn.rihab.analysteservice.client.IaServiceClient;
import tn.rihab.analysteservice.dto.ia.*;
import tn.rihab.analysteservice.matching.matchers.*;
import tn.rihab.analysteservice.model.MatchingResult;
import tn.rihab.analysteservice.repository.MatchingResultRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Coordonne l'analyse multidimensionnelle du matching Phase 3.
 * Version optimisée avec Jackson pour une sérialisation robuste.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MatchingEngine {

    private final IaServiceClient         iaClient;
    private final CompetencesMatcher      competencesMatcher;
    private final ReferencesMatcher       referencesMatcher;
    private final ExpertsMatcher          expertsMatcher;
    private final ClientMatcher           clientMatcher;
    private final MatchingResultRepository matchingRepo;
    private final ObjectMapper            objectMapper; // 🚀 Injecté automatiquement par Spring

    /**
     * Lance le matching complet pour un dossier.
     */
    @Transactional
    public MatchingResult runMatching(DossierDto dossier, String documentText) {
        UUID dossierId = dossier.getId();
        log.info("[Matching] Démarrage Phase 3 pour dossier {}", dossierId);

        // ── Étape 1 : Extraction des exigences depuis la DP ───────────────────
        ExtractionRequestDto reqExigences = ExtractionRequestDto.builder()
                .dossierId(dossierId)
                .documentText(documentText)
                .phase("REQUIREMENTS")
                .build();
        RequirementsResponseDto requirements = iaClient.extractRequirements(reqExigences);

        // ── Étape 2 : Matching compétences ────────────────────────────────────
        var competencesResult = competencesMatcher.match(requirements.getQualifsExigees());

        // ── Étape 3 : Matching références ─────────────────────────────────────
        Double budget = extractBudget(dossier.getBudgetGlobal());
        var referencesResult = referencesMatcher.match(
                requirements.getSecteurDetecte(), dossier.getPays(), budget);

        // ── Étape 4 : Matching experts ────────────────────────────────────────
        var expertsResult = expertsMatcher.match(requirements.getExpertsRequis(), dossier);

        // ── Étape 5 : Relation client ─────────────────────────────────────────
        var clientResult = clientMatcher.match(dossier.getClient());

        // ── Étape 6 : Matrice de différenciation via ia-service ───────────────
        MatchingContextDto context = MatchingContextDto.builder()
                .dossierId(dossierId)
                .refsExigees(requirements.getRefsExigees())
                .qualifsExigees(requirements.getQualifsExigees())
                .expertsRequis(requirements.getExpertsRequis())
                .tauxCouvertureCompetences(competencesResult.taux())
                .tauxCouvertureExperts(expertsResult.tauxCouverture())
                .gapRefs(referencesResult.gapRefsJson())
                .pays(dossier.getPays())
                .secteur(requirements.getSecteurDetecte())
                .bailleurs(dossier.getBailleurs())
                .build();

        MatrixResponseDto matrice = iaClient.generateMatrix(context);

        // Sérialisation sécurisée via Jackson
        String matriceJson = serializeObject(matrice != null ? matrice.getLignes() : null);

        // Alignement stratégique
        String alignement = competencesResult.taux() >= 0.8 ? "Oui"
                : competencesResult.taux() >= 0.5 ? "Partiel" : "Non";

        // ── Étape 7 : Persister MatchingResult ───────────────────────────────
        MatchingResult result = matchingRepo.findByDossierId(dossierId)
                .orElse(MatchingResult.builder().dossierId(dossierId).build());

        result.setTauxCouvertureCompetences(competencesResult.taux());
        result.setCompetencesDetail(competencesResult.detailJson());
        result.setRefsExigees(serializeObject(requirements.getRefsExigees()));
        result.setGapRefs(referencesResult.gapRefsJson());
        result.setExpertsRequis(serializeObject(requirements.getExpertsRequis()));
        result.setTauxCouvertureExperts(expertsResult.tauxCouverture());
        result.setExpertsDetail(expertsResult.expertsDetailJson());
        result.setRelationClientNiveau(clientResult.niveau());
        result.setRelationClientNbMissions(clientResult.nbMissions());
        result.setMatriceDiff(matriceJson);
        result.setQualifsExigees(serializeObject(requirements.getQualifsExigees()));
        result.setSecteurAo(requirements.getSecteurDetecte());
        result.setAlignementStrategique(alignement);

        MatchingResult saved = matchingRepo.save(result);

        log.info("[Matching] Dossier {} — compétences={:.0f}% experts={:.0f}% client=niv{} alignement={}",
                dossierId, competencesResult.taux() * 100, expertsResult.tauxCouverture() * 100,
                clientResult.niveau(), alignement);

        return saved;
    }

    // ── Utilitaires de sérialisation Jackson ───────────────────────────────────

    /**
     * Convertit n'importe quel objet ou liste en JSON String de manière sécurisée.
     */
    private String serializeObject(Object obj) {
        if (obj == null) return "[]";
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            log.error("[MatchingEngine] Erreur lors de la sérialisation en JSON", e);
            return "[]";
        }
    }

    /**
     * Extrait le budget en interprétant les modificateurs textuels (M, M€, K, Millions)
     */
    private Double extractBudget(String budgetGlobal) {
        if (budgetGlobal == null || budgetGlobal.isBlank()) return null;
        try {
            String clean = budgetGlobal.toLowerCase().trim();

            double multiplicateur = 1.0;
            if (clean.contains("m") || clean.contains("million")) {
                multiplicateur = 1_000_000.0;
            } else if (clean.contains("k") || clean.contains("mille")) {
                multiplicateur = 1_000.0;
            }

            // Nettoyer en conservant uniquement les chiffres et les séparateurs décimaux
            String chiffres = clean.replaceAll("[^0-9.,]", "").replace(",", ".");
            if (chiffres.isBlank()) return null;

            return Double.parseDouble(chiffres) * multiplicateur;
        } catch (NumberFormatException e) {
            log.warn("[MatchingEngine] Impossible de parser le budget global : {}", budgetGlobal);
            return null;
        }
    }
}