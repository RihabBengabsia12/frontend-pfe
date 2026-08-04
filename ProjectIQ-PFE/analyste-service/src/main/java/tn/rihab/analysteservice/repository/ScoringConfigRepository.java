package tn.rihab.analysteservice.repository;

import tn.rihab.analysteservice.model.ScoringConfig; // <--- CORRIGÉ ICI
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Repository ScoringConfig.
 * findCurrent() utilisé pour la configuration globale (dossier_id IS NULL).
 */
@Repository
public interface ScoringConfigRepository extends JpaRepository<ScoringConfig, UUID> {

    Optional<ScoringConfig> findByDossierId(UUID dossierId);

    @Query("SELECT c FROM ScoringConfig c WHERE c.dossierId IS NULL")
    Optional<ScoringConfig> findGlobalConfig();

    default ScoringConfig findCurrent() {
        return findGlobalConfig()
                .orElseThrow(() -> new IllegalStateException(
                        "Aucune ScoringConfig globale trouvée — vérifier ScoringConfigLoader"));
    }
}