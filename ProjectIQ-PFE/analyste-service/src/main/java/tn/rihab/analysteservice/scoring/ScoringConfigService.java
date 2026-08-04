package tn.rihab.analysteservice.scoring;

import tn.rihab.analysteservice.model.ScoringConfig;
import tn.rihab.analysteservice.repository.ScoringConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * CRUD de la configuration de scoring P-Win.
 * Modifiable via GET/PUT /api/config/scoring sans redémarrage.
 * Singleton applicatif : une seule ligne dans la table scoring_config.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ScoringConfigService {

    private final ScoringConfigRepository repo;

    /** Retourne la configuration active (globale). */
    public ScoringConfig getCurrent() {
        return repo.findCurrent();
    }

    /** Retourne la configuration spécifique au dossier, sinon la globale. */
    public ScoringConfig getConfigForDossier(java.util.UUID dossierId) {
        if (dossierId == null) return getCurrent();
        return repo.findByDossierId(dossierId).orElseGet(this::getCurrent);
    }

    /**
     * Met à jour la configuration de scoring globale.
     */
    @Transactional
    public ScoringConfig update(ScoringConfig updated) {
        validateConfig(updated);
        ScoringConfig current = repo.findCurrent();
        return updateFieldsAndSave(current, updated);
    }

    /**
     * Met à jour ou crée la configuration de scoring spécifique pour un dossier.
     */
    @Transactional
    public ScoringConfig updateForDossier(java.util.UUID dossierId, ScoringConfig updated) {
        validateConfig(updated);
        ScoringConfig current = repo.findByDossierId(dossierId).orElseGet(() -> {
            ScoringConfig newConfig = new ScoringConfig();
            newConfig.setDossierId(dossierId);
            return newConfig;
        });
        return updateFieldsAndSave(current, updated);
    }

    private void validateConfig(ScoringConfig updated) {
        double somme = safeSum(
                updated.getPoidsA_faisabilite(),
                updated.getPoidsB_rentabilite(),
                updated.getPoidsC_risques(),
                updated.getPoidsD_concurrence(),
                updated.getPoidsE_conformite()
        );

        if (Math.abs(somme - 1.0) > 0.01) {
            throw new IllegalArgumentException(
                    String.format("Les pondérations A+B+C+D+E doivent sommer à 1.0 (reçu : %.3f)", somme));
        }

        if (updated.getSeuilNoGo() >= updated.getSeuilGoConditionnel()
                || updated.getSeuilGoConditionnel() >= updated.getSeuilGoFort()) {
            throw new IllegalArgumentException(
                    "Seuils invalides : seuilNoGo < seuilGoConditionnel < seuilGoFort requis");
        }
    }

    private ScoringConfig updateFieldsAndSave(ScoringConfig current, ScoringConfig updated) {
        current.setSeuilNoGo(updated.getSeuilNoGo());
        current.setSeuilGoConditionnel(updated.getSeuilGoConditionnel());
        current.setSeuilGoFort(updated.getSeuilGoFort());
        current.setPoidsA_faisabilite(updated.getPoidsA_faisabilite());
        current.setPoidsB_rentabilite(updated.getPoidsB_rentabilite());
        current.setPoidsC_risques(updated.getPoidsC_risques());
        current.setPoidsD_concurrence(updated.getPoidsD_concurrence());
        current.setPoidsE_conformite(updated.getPoidsE_conformite());
        current.setTjmMinEgis(updated.getTjmMinEgis());
        current.setTjmMaxEgis(updated.getTjmMaxEgis());
        current.setSeuilCompatCompetences(updated.getSeuilCompatCompetences());
        current.setSeuilCompatExperts(updated.getSeuilCompatExperts());
        current.setSeuilAlignementOui(updated.getSeuilAlignementOui());
        current.setSeuilAlignementPartiel(updated.getSeuilAlignementPartiel());

        ScoringConfig saved = repo.save(current);
        log.info("[ScoringConfig] Mise à jour (dossierId={}) — seuilNoGo={}, seuilGo={}, seuilGoFort={}, " +
                        "poids A={} B={} C={} D={} E={}, seuilCompatCompetences={}, seuilCompatExperts={}, seuilAlignementOui={}, seuilAlignementPartiel={}",
                saved.getDossierId(),
                saved.getSeuilNoGo(), saved.getSeuilGoConditionnel(), saved.getSeuilGoFort(),
                saved.getPoidsA_faisabilite(), saved.getPoidsB_rentabilite(),
                saved.getPoidsC_risques(), saved.getPoidsD_concurrence(), saved.getPoidsE_conformite(),
                saved.getSeuilCompatCompetences(), saved.getSeuilCompatExperts(),
                saved.getSeuilAlignementOui(), saved.getSeuilAlignementPartiel());

        return saved;
    }

    private double safeSum(Double... vals) {
        double s = 0.0;
        for (Double v : vals) if (v != null) s += v;
        return s;
    }
}