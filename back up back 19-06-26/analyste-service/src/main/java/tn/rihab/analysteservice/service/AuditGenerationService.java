package tn.rihab.analysteservice.service;

import tn.rihab.analysteservice.client.*;
import tn.rihab.analysteservice.dto.AuditEntryDto;
import tn.rihab.analysteservice.dto.DossierDto;
import tn.rihab.analysteservice.dto.ia.*;
import tn.rihab.analysteservice.messaging.AnalysteEventPublisher;
import tn.rihab.analysteservice.model.*;
import tn.rihab.analysteservice.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Génère le rapport d'audit complet (Phase 6).
 *
 * Déclenché par l'événement DOSSIER_SUBMITTED (project-service).
 *
 * Contenu du rapport d'audit :
 *   - Timeline chronologique de toutes les actions du cycle de vie
 *   - Score P-Win avec décomposition par axe
 *   - Décision finale et validateurs
 *   - Traçabilité des corrections humaines
 *   - Forçages Go éventuels (avec justification)
 *   - Analyse narrative générée par Claude (points d'amélioration)
 *   - Résultat final (gagné/perdu — saisi ultérieurement)
 *
 * Publie AUDIT_GENERATED → project-service passe en ARCHIVED.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuditGenerationService {

    private final ProjectServiceClient    projectClient;
    private final IaServiceClient         iaClient;
    private final PackStorageService      storageService;
    private final AnalysteEventPublisher  publisher;
    private final PwinScoreRepository     pwinRepo;
    private final AnalyseDossierRepository analyseRepo;

    /**
     * Génère le rapport d'audit DOCX et le stocke sur MinIO.
     * Publie l'événement AUDIT_GENERATED vers project-service.
     *
     * @param dossierId ID du dossier à auditer
     */
    public void generateAuditReport(UUID dossierId) {
        log.info("[Audit] Génération rapport d'audit — dossier {}", dossierId);

        // 1. Récupérer toutes les données nécessaires
        DossierDto dossier         = projectClient.getDossier(dossierId);
        List<AuditEntryDto> trail  = projectClient.getAuditHistory(dossierId);
        PwinScore pwin             = pwinRepo.findByDossierId(dossierId).orElse(null);

        // 2. Construire le contexte pour Claude
        AuditContextDto context = AuditContextDto.builder()
                .dossierId(dossierId)
                .intituleOffre(dossier.getIntituleOffre())
                .client(dossier.getClient())
                .pwinScore(pwin != null ? pwin.getScoreGlobal() : null)
                .decisionFinale(pwin != null ? pwin.getDecisionAuto() : "INCONNU")
                .auditTrail(trail)
                .nbChampsCorrigesHumain((int) trail.stream()
                        .filter(e -> "FIELD_CORRECTED".equals(e.getAction())).count())
                .aEuForceGo(trail.stream()
                        .anyMatch(e -> "FORCE_GO".equals(e.getAction())))
                .build();

        // 3. Générer l'analyse narrative via Claude
        AuditReportResponseDto aiReport = null;
        try {
            aiReport = iaClient.generateAuditReport(context);
        } catch (Exception e) {
            log.warn("[Audit] Génération Claude échouée (non bloquant) : {}", e.getMessage());
        }

        // 4. Générer le DOCX du rapport d'audit
        String auditDocxPath = generateAuditDocx(
                dossierId, dossier, trail, pwin, aiReport);

        // 5. Publier → project-service stocke le chemin et passe en ARCHIVED
        publisher.publishAuditGenerated(dossierId, auditDocxPath);

        log.info("[Audit] Rapport d'audit généré : {}", auditDocxPath);
    }

    // ── Génération DOCX du rapport d'audit ─────────────────────────────────────

    private String generateAuditDocx(UUID dossierId,
                                     DossierDto dossier,
                                     List<AuditEntryDto> trail,
                                     PwinScore pwin,
                                     AuditReportResponseDto aiReport) {
        try (InputStream tplStream = new ClassPathResource(
                "templates/Rapport-Audit-Template.docx").getInputStream();
             XWPFDocument doc = new XWPFDocument(tplStream)) {

            // Construire la map de remplacement pour le template
            Map<String, String> valeurs = buildAuditValues(dossier, trail, pwin, aiReport);

            // Remplacer les placeholders dans le document
            for (var para : doc.getParagraphs()) {
                replaceInParagraph(para, valeurs);
            }
            for (var table : doc.getTables()) {
                for (var row : table.getRows()) {
                    for (var cell : row.getTableCells()) {
                        for (var para : cell.getParagraphs()) {
                            replaceInParagraph(para, valeurs);
                        }
                    }
                }
            }

            // Convertir en bytes et uploader
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.write(baos);
            byte[] bytes = baos.toByteArray();

            String objectName = dossierId + "/Audit_"
                    + sanitize(dossier.getIntituleOffre()) + ".docx";

            return storageService.uploadBytes(
                    "rapports-audit", objectName, bytes,
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

        } catch (Exception e) {
            log.error("[Audit] Erreur génération DOCX : {}", e.getMessage(), e);
            throw new RuntimeException("Génération rapport audit échouée", e);
        }
    }

    // ── Construction des valeurs de remplacement ────────────────────────────────

    private Map<String, String> buildAuditValues(DossierDto dossier,
                                                 List<AuditEntryDto> trail,
                                                 PwinScore pwin,
                                                 AuditReportResponseDto aiReport) {

        String timeline = buildTimeline(trail);
        String scoringSection = buildScoringSection(pwin);
        String correctionsSection = buildCorrectionsSection(trail);
        String narratif = aiReport != null ? aiReport.getNarratif() : "Non disponible";
        String ameliorations = aiReport != null ? aiReport.getPointsAmelioration() : "Non disponible";

        return Map.ofEntries(
                Map.entry("[[INTITULE_OFFRE]]",         safe(dossier.getIntituleOffre())),
                Map.entry("[[CLIENT]]",                  safe(dossier.getClient())),
                Map.entry("[[PAYS]]",                    safe(dossier.getPays())),
                Map.entry("[[BAILLEURS]]",               safe(dossier.getBailleurs())),
                Map.entry("[[BUDGET_GLOBAL]]",           safe(dossier.getBudgetGlobal())),
                Map.entry("[[DT_LIM_SOUM]]",             safe(fmt(dossier.getDtLimSoum()))),
                Map.entry("[[PWIN_SCORE]]",              pwin != null ? String.format("%.1f%%", pwin.getScoreGlobal()) : "N/A"),
                Map.entry("[[DECISION_FINALE]]",         pwin != null ? pwin.getDecisionAuto() : "N/A"),
                Map.entry("[[RISQUE_REDHIBITOIRE]]",     pwin != null && Boolean.TRUE.equals(pwin.getRisqueRedhibitoire())
                        ? "OUI — " + pwin.getRisqueRedhibitoireChamp() : "Non"),
                Map.entry("[[FORCE_GO]]",                pwin != null && Boolean.TRUE.equals(pwin.getForceGo())
                        ? "OUI — " + safe(pwin.getForceGoJustif()) : "Non"),
                Map.entry("[[TIMELINE_ACTIONS]]",        timeline),
                Map.entry("[[SCORING_DETAIL]]",          scoringSection),
                Map.entry("[[CORRECTIONS_HUMAINES]]",    correctionsSection),
                Map.entry("[[NB_CORRECTIONS]]",          String.valueOf(trail.stream()
                        .filter(e -> "FIELD_CORRECTED".equals(e.getAction())).count())),
                Map.entry("[[ANALYSE_NARRATIVE]]",       narratif),
                Map.entry("[[POINTS_AMELIORATION]]",     ameliorations),
                Map.entry("[[DATE_GENERATION]]",         java.time.LocalDate.now().toString())
        );
    }

    // ── Sections textuelles du rapport ─────────────────────────────────────────

    private String buildTimeline(List<AuditEntryDto> trail) {
        if (trail == null || trail.isEmpty()) return "Aucune action enregistrée.";
        StringBuilder sb = new StringBuilder();
        for (AuditEntryDto entry : trail) {
            sb.append(String.format("  [%s] %s — %s → %s\n",
                    entry.getTimestamp() != null ? entry.getTimestamp().toString().substring(0, 16) : "??:??",
                    safe(entry.getAction()),
                    safe(entry.getActeur()),
                    safe(entry.getStatusApres())));
        }
        return sb.toString();
    }

    private String buildScoringSection(PwinScore pwin) {
        if (pwin == null) return "Scoring non disponible.";
        return String.format(
                "Score Global : %.1f%%  |  Décision : %s\n" +
                        "  Axe A (Faisabilité 25%%) : %.0f%%\n" +
                        "  Axe B (Rentabilité 25%%) : %.0f%%\n" +
                        "  Axe C (Risques    25%%) : %.0f%%  %s\n" +
                        "  Axe D (Concurrence15%%) : %.0f%%\n" +
                        "  Axe E (Conformité 10%%) : %.0f%%",
                pwin.getScoreGlobal(), pwin.getDecisionAuto(),
                safe100(pwin.getScoreA()), safe100(pwin.getScoreB()),
                safe100(pwin.getScoreC()),
                Boolean.TRUE.equals(pwin.getRisqueRedhibitoire())
                        ? "⚠ RÉDHIBITOIRE : " + pwin.getRisqueRedhibitoireChamp() : "",
                safe100(pwin.getScoreD()), safe100(pwin.getScoreE()));
    }

    private String buildCorrectionsSection(List<AuditEntryDto> trail) {
        StringBuilder sb = new StringBuilder();
        trail.stream()
                .filter(e -> "FIELD_CORRECTED".equals(e.getAction()))
                .forEach(e -> sb.append(String.format("  - %s par %s : %s\n",
                        safe(e.getAction()), safe(e.getActeur()), safe(e.getDetail()))));
        return sb.length() > 0 ? sb.toString() : "Aucune correction manuelle.";
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private void replaceInParagraph(org.apache.poi.xwpf.usermodel.XWPFParagraph para,
                                    Map<String, String> valeurs) {
        StringBuilder full = new StringBuilder();
        para.getRuns().forEach(r -> full.append(r.getText(0) != null ? r.getText(0) : ""));
        String text = full.toString();
        if (!text.contains("[[")) return;
        for (Map.Entry<String, String> e : valeurs.entrySet()) {
            text = text.replace(e.getKey(), safe(e.getValue()));
        }
        if (!para.getRuns().isEmpty()) {
            para.getRuns().get(0).setText(text, 0);
            for (int i = 1; i < para.getRuns().size(); i++) {
                para.getRuns().get(i).setText("", 0);
            }
        }
    }

    private String safe(String v)    { return v != null ? v : ""; }
    private String fmt(Object v)     { return v != null ? v.toString() : ""; }
    private double safe100(Double v) { return v != null ? v * 100 : 0; }

    private String sanitize(String name) {
        if (name == null) return "audit";
        return name.replaceAll("[^a-zA-Z0-9À-ÿ_\\-]", "_")
                .substring(0, Math.min(name.length(), 40));
    }
}