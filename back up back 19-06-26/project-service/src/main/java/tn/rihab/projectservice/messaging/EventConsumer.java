package tn.rihab.projectservice.messaging;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import tn.rihab.projectservice.config.RabbitMQConfig;
import tn.rihab.projectservice.messaging.dto.DossierEvent;
import tn.rihab.projectservice.model.DossierStatus;
import tn.rihab.projectservice.model.entity.Dossier;
import tn.rihab.projectservice.repository.DossierRepository;
import tn.rihab.projectservice.service.AuditTrailService;

/**
 * Consomme les événements publiés par analyste-service.
 *
 * Queues écoutées :
 *   q.scoring.completed     → stocker P-Win, passer en SCORING ou MANUAL_INTERVENTION
 *   q.matching.completed    → stocker résultats, passer en MATCHING
 *   q.apo.generated         → stocker URLs docs, passer en REPORT_GENERATED ou PACK_READY
 *   q.audit.generated       → stocker rapport audit, passer en ARCHIVED
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EventConsumer {

    private final DossierRepository dossierRepository;
    private final AuditTrailService auditTrailService;
    private final ObjectMapper      objectMapper;

    // ── Scoring terminé ────────────────────────────────────────────────────
    @RabbitListener(queues = RabbitMQConfig.Q_SCORING_COMPLETED)
    public void onScoringCompleted(DossierEvent event) {
        log.info("[RabbitMQ] Reçu SCORING_COMPLETED pour dossier {}", event.getDossierId());
        try {
            Dossier dossier = findDossier(event);

            // Extraire le score P-Win du payload
            JsonNode payload = objectMapper.readTree(event.getPayload());
            double pwin     = payload.path("pwinScore").asDouble(0);
            String decision = payload.path("decision").asText("MANUAL"); // GO|NO_GO|MANUAL

            dossier.setPwinScore(pwin);

            DossierStatus nouveauStatut = switch (decision) {
                case "NO_GO"  -> DossierStatus.MANUAL_INTERVENTION;
                case "GO"     -> DossierStatus.SCORING;
                default       -> DossierStatus.MANUAL_INTERVENTION;
            };

            DossierStatus ancien = dossier.getStatus();
            dossier.setStatus(nouveauStatut);
            dossierRepository.save(dossier);

            auditTrailService.log(dossier.getId(), "SCORING_COMPLETED",
                    "analyste-service", event.getPayload(), nouveauStatut);

            log.info("[Dossier {}] Scoring terminé — P-Win={:.1f}% → {}",
                    dossier.getId(), pwin, nouveauStatut);

        } catch (Exception e) {
            log.error("[RabbitMQ] Erreur traitement SCORING_COMPLETED: {}", e.getMessage(), e);
        }
    }

    // ── Matching terminé ───────────────────────────────────────────────────
    @RabbitListener(queues = RabbitMQConfig.Q_MATCHING_COMPLETED)
    public void onMatchingCompleted(DossierEvent event) {
        log.info("[RabbitMQ] Reçu MATCHING_COMPLETED pour dossier {}", event.getDossierId());
        try {
            Dossier dossier = findDossier(event);
            dossier.setStatus(DossierStatus.MATCHING);
            dossierRepository.save(dossier);

            auditTrailService.log(dossier.getId(), "MATCHING_COMPLETED",
                    "analyste-service", event.getPayload(), DossierStatus.MATCHING);

        } catch (Exception e) {
            log.error("[RabbitMQ] Erreur traitement MATCHING_COMPLETED: {}", e.getMessage(), e);
        }
    }

    // ── APO et documents générés ───────────────────────────────────────────
    /**
     * Reçu quand analyste-service a terminé la génération de :
     *   - L'APO DOCX remplie (56 placeholders)
     *   - La méthodologie DOCX (template méthodologie)
     *   - Le rapport général DOCX (template rapport résultat)
     * → Passe en REPORT_GENERATED, puis génère le pack ZIP → PACK_READY.
     */
    @RabbitListener(queues = RabbitMQConfig.Q_APO_GENERATED)
    public void onApoGenerated(DossierEvent event) {
        log.info("[RabbitMQ] Reçu APO_GENERATED pour dossier {}", event.getDossierId());
        try {
            Dossier dossier = findDossier(event);
            JsonNode payload = objectMapper.readTree(event.getPayload());

            // Stocker les chemins MinIO des documents générés
            if (payload.has("apoDocxPath"))
                dossier.setApoDocxPath(payload.path("apoDocxPath").asText());
            if (payload.has("methodoPath"))
                dossier.setMethodoDocxPath(payload.path("methodoPath").asText());
            if (payload.has("rapportPath"))
                dossier.setRapportPath(payload.path("rapportPath").asText());
            if (payload.has("packZipPath")) {
                dossier.setPackZipPath(payload.path("packZipPath").asText());
                dossier.setStatus(DossierStatus.PACK_READY);
            } else {
                dossier.setStatus(DossierStatus.REPORT_GENERATED);
            }

            dossierRepository.save(dossier);

            auditTrailService.log(dossier.getId(), "APO_GENERATED",
                    "analyste-service", event.getPayload(), dossier.getStatus());

        } catch (Exception e) {
            log.error("[RabbitMQ] Erreur traitement APO_GENERATED: {}", e.getMessage(), e);
        }
    }

    // ── Rapport d'audit généré ─────────────────────────────────────────────
    @RabbitListener(queues = RabbitMQConfig.Q_AUDIT_GENERATED)
    public void onAuditGenerated(DossierEvent event) {
        log.info("[RabbitMQ] Reçu AUDIT_GENERATED pour dossier {}", event.getDossierId());
        try {
            Dossier dossier = findDossier(event);
            JsonNode payload = objectMapper.readTree(event.getPayload());

            if (payload.has("auditReportPath"))
                dossier.setAuditReportPath(payload.path("auditReportPath").asText());

            dossier.setStatus(DossierStatus.ARCHIVED);
            dossierRepository.save(dossier);

            auditTrailService.log(dossier.getId(), "ARCHIVED",
                    "analyste-service", event.getPayload(), DossierStatus.ARCHIVED);

        } catch (Exception e) {
            log.error("[RabbitMQ] Erreur traitement AUDIT_GENERATED: {}", e.getMessage(), e);
        }
    }

    // ── Utilitaire ─────────────────────────────────────────────────────────
    private Dossier findDossier(DossierEvent event) {
        return dossierRepository.findById(event.getDossierId())
                .orElseThrow(() -> new IllegalStateException(
                        "Dossier introuvable: " + event.getDossierId()));
    }
}