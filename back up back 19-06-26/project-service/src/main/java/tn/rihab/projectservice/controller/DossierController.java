package tn.rihab.projectservice.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import tn.rihab.projectservice.model.DossierStatus;
import tn.rihab.projectservice.model.entity.Dossier;
import tn.rihab.projectservice.service.DossierService;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Endpoints REST pour la gestion des dossiers.
 * Base URL : /api/dossiers
 *
 * Phase 1 — Dépôt :
 *   POST   /api/dossiers/upload          Upload AP + TDR → extraction P1
 *   GET    /api/dossiers                 Dashboard — liste triée
 *   GET    /api/dossiers/{id}            Détail d'un dossier
 *   GET    /api/dossiers/{id}/status     Polling statut (Angular 30s)
 *   PUT    /api/dossiers/{id}/priority   Override priorité manuelle
 *   GET    /api/dossiers/{id}/document-text  Texte brut (pour analyste-service)
 *
 * Le CORS est géré par l'API Gateway — PAS de @CrossOrigin ici.
 */
@RestController
@RequestMapping("/api/dossiers")
@RequiredArgsConstructor
@Slf4j
public class DossierController {

    private final DossierService dossierService;

    // ── POST /api/dossiers/upload ─────────────────────────────────────────────

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Dossier> upload(
            @RequestPart("tdr") MultipartFile tdrFile,
            @RequestParam("dateLimite") String dateLimite) {

        log.info("[Upload] Dépôt du fichier : {}", tdrFile.getOriginalFilename());
        validateFile(tdrFile);

        LocalDate dt = LocalDate.parse(dateLimite);

        // Cette méthode va maintenant :
        // 1. Enregistrer le dossier en base avec statut UPLOADED
        // 2. Lancer le parsing en arrière-plan via @Async
        // 3. Retourner le dossier immédiatement
        Dossier dossier = dossierService.createDossierWithAsyncParsing(tdrFile, dt);

        return ResponseEntity.status(HttpStatus.CREATED).body(dossier);
    }
    // Ajoutez cette méthode dans votre DossierController
    @PostMapping("/{id}/analyze")
    public ResponseEntity<String> launchAnalysis(@PathVariable UUID id) {
        log.info("[Analyse] Lancement manuel pour le dossier ID : {}", id);

        // Vous appellerez ici votre service IA
        dossierService.launchAnalysis(id);

        return ResponseEntity.ok("Analyse lancée avec succès");
    }

    @GetMapping
    public ResponseEntity<List<Dossier>> getAll() {
        return ResponseEntity.ok(dossierService.getAll());
    }

    // ── GET /api/dossiers/{id} ─────────────────────────────────────────────────

    @GetMapping("/{id}")
    public ResponseEntity<Dossier> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(dossierService.findById(id));
    }

    // ── GET /api/dossiers/{id}/status ──────────────────────────────────────────

    @GetMapping("/{id}/status")
    public ResponseEntity<Map<String, Object>> getStatus(@PathVariable UUID id) {
        Dossier d = dossierService.findById(id);
        return ResponseEntity.ok(Map.of(
                "dossierId",      d.getId(),
                "status",         d.getStatus(),
                "pwinScore",      d.getPwinScore()      != null ? d.getPwinScore()      : "N/A",
                "joursOuvrables", d.getJoursOuvrables() != null ? d.getJoursOuvrables() : 0,
                "priorite",       d.getPriorite()       != null ? d.getPriorite()       : 2
        ));
    }

    // ── PUT /api/dossiers/{id}/priority ────────────────────────────────────────

    @PutMapping("/{id}/priority")
    public ResponseEntity<Dossier> updatePriority(
            @PathVariable UUID id,
            @RequestParam Integer priorite) {

        if (priorite < 1 || priorite > 3) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(dossierService.updatePriority(id, priorite));
    }

    // ── GET /api/dossiers/{id}/document-text ──────────────────────────────────

    @GetMapping("/{id}/document-text")
    public ResponseEntity<String> getDocumentText(@PathVariable UUID id) {
        return ResponseEntity.ok(dossierService.getDocumentText(id));
    }

    // ── Validation de fichier ──────────────────────────────────────────────────

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Fichier vide ou manquant");
        }
        String name = file.getOriginalFilename();
        if (name == null) {
            throw new IllegalArgumentException("Nom de fichier manquant");
        }
        String lower = name.toLowerCase();
        if (!lower.endsWith(".pdf") && !lower.endsWith(".docx") && !lower.endsWith(".doc")) {
            throw new IllegalArgumentException(
                    "Format non supporté : " + name + " — PDF ou DOCX uniquement");
        }
        if (file.getSize() > 20 * 1024 * 1024) {
            throw new IllegalArgumentException(
                    "Fichier trop volumineux : " + name + " — 20 Mo maximum");
        }
    }
}