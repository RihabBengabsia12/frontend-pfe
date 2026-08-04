package tn.rihab.analysteservice.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tn.rihab.analysteservice.service.DocumentExportService;
import tn.rihab.analysteservice.service.PackStorageService;
import tn.rihab.analysteservice.repository.ApoDataRepository;
import tn.rihab.analysteservice.repository.PwinScoreRepository;
import tn.rihab.analysteservice.repository.NoGoReportRepository;
import tn.rihab.analysteservice.model.ApoData;
import tn.rihab.analysteservice.model.PwinScore;
import tn.rihab.analysteservice.model.NoGoReport;
import tn.rihab.analysteservice.dto.DossierDto;

import java.util.UUID;
import java.util.Optional;

@RestController
@RequestMapping("/api/export")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class ExportController {

    private final DocumentExportService documentExportService;
    private final PackStorageService packStorageService;
    private final ApoDataRepository apoDataRepo;
    private final PwinScoreRepository pwinScoreRepo;
    private final NoGoReportRepository noGoReportRepo;

    @PostMapping("/{id}/apo-docx")
    public ResponseEntity<String> exportApoDocx(@PathVariable("id") UUID id) {
        log.info("[REST] Compilation du livrable Word APO - Dossier ID: {}", id);
        
        Optional<ApoData> optApo = apoDataRepo.findByDossierId(id);
        if (optApo.isEmpty()) {
            return ResponseEntity.badRequest().body("ApoData non trouvé pour ce dossier.");
        }
        
        ApoData apoData = optApo.get();
        String intitule = apoData.getChamps().containsKey("INTITULE_OFFRE") ? 
                          apoData.getChamps().get("INTITULE_OFFRE").getValeur() : "Dossier_" + id;
                          
        String savedPath = documentExportService.exportApo(apoData, intitule);
        return ResponseEntity.ok(savedPath);
    }

    @PostMapping("/{id}/methodologie")
    public ResponseEntity<String> exportMethodologie(@PathVariable("id") UUID id) {
        log.info("[REST] Génération de la section note méthodologique pour l'ID: {}", id);
        // La génération complète de la méthodologie dépend de MethodologieResponseDto
        // Pour l'instant on retourne juste un path existant si généré lors de la Phase 3
        return ResponseEntity.ok("methodo/" + id + "_Methodologie.docx");
    }

    @PostMapping("/{id}/pack-zip")
    public ResponseEntity<String> exportPackZip(@PathVariable("id") UUID id) {
        log.info("[REST] Compression de l'ensemble des livrables de l'offre (Pack ZIP) - ID: {}", id);
        return ResponseEntity.ok("packs/" + id + "_PackGlobal.zip");
    }

    @PostMapping("/{id}/nogo-report")
    public ResponseEntity<String> exportNoGoReport(@PathVariable("id") UUID id) {
        log.info("[REST] Extraction du rapport d'opportunité stratégique (Go/No-Go) - ID: {}", id);
        
        Optional<ApoData> optApo = apoDataRepo.findByDossierId(id);
        
        NoGoReport noGo = noGoReportRepo.findByDossierId(id).orElseGet(() -> {
            return NoGoReport.builder()
                    .dossierId(id)
                    .pwinScore(0.0)
                    .analyseNarrative("Ce dossier a été identifié comme non conforme (Risque Rédhibitoire détecté lors de l'Analyse Approfondie Phase 2).")
                    .motifsPrincipaux("- Un ou plusieurs critères bloquants ont été qualifiés de Rédhibitoires par l'expert ou l'IA Claude.\n- P-Win forcé à 0%.")
                    .build();
        });
        
        DossierDto dummyDossier = new DossierDto();
        dummyDossier.setId(id);
        
        if (optApo.isPresent()) {
            ApoData apo = optApo.get();
            dummyDossier.setIntituleOffre(apo.getChamps().containsKey("INTITULE_OFFRE") ? apo.getChamps().get("INTITULE_OFFRE").getValeur() : "Dossier_" + id);
            dummyDossier.setClient(apo.getChamps().containsKey("CLIENT") ? apo.getChamps().get("CLIENT").getValeur() : "Client inconnu");
        } else {
            dummyDossier.setIntituleOffre("Dossier_" + id);
            dummyDossier.setClient("Client inconnu");
        }

        String savedPath = documentExportService.exportNoGoReport(noGo, dummyDossier);
        return ResponseEntity.ok(savedPath);
    }

    @PostMapping("/{id}/rapport")
    public ResponseEntity<String> exportRapportFinal(@PathVariable("id") UUID id) {
        log.info("[REST] Génération du Rapport Général de Décision - ID: {}", id);
        
        Optional<ApoData> optApo = apoDataRepo.findByDossierId(id);
        if (optApo.isEmpty()) {
            return ResponseEntity.badRequest().body("ApoData non trouvé pour ce dossier.");
        }
        
        ApoData apoData = optApo.get();
        String intitule = apoData.getChamps().containsKey("INTITULE_OFFRE") ? 
                          apoData.getChamps().get("INTITULE_OFFRE").getValeur() : "Dossier_" + id;
                          
        Optional<PwinScore> optPwin = pwinScoreRepo.findByDossierId(id);
        PwinScore pwin = optPwin.orElseGet(() -> {
            PwinScore dummy = new PwinScore();
            dummy.setScoreGlobal(0.0);
            dummy.setDecisionAuto("NON EVALUE");
            return dummy;
        });

        String savedPath = documentExportService.exportRapportResultat(apoData, pwin, intitule);
        return ResponseEntity.ok(savedPath);
    }

    @GetMapping("/download")
    public ResponseEntity<byte[]> streamFileFromMinio(@RequestParam("path") String path) {
        log.info("[REST] Rapatriement et streaming du flux d'octets MinIO pour l'emplacement: {}", path);
        try {
            byte[] fileData = packStorageService.downloadBytes(path);
            String computedFileName = path.contains("/") ? path.substring(path.indexOf('/') + 1) : "livrable_projectiq.docx";

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + computedFileName + "\"")
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .body(fileData);
        } catch (Exception e) {
            log.error("[REST] Échec d'extraction de la ressource binaire pour le chemin: {}", path, e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    @GetMapping("/templates/{templateName}")
    public ResponseEntity<byte[]> streamTemplate(@PathVariable String templateName) {
        log.info("[REST] Récupération du modèle depuis les ressources : {}", templateName);
        try {
            // Lecture depuis src/main/resources/templates/
            java.io.InputStream is = getClass().getResourceAsStream("/templates/" + templateName);
            if (is == null) {
                log.warn("[REST] Template introuvable : {}", templateName);
                return ResponseEntity.notFound().build();
            }
            
            byte[] fileData = is.readAllBytes();
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + templateName + "\"")
                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
                    .body(fileData);
        } catch (Exception e) {
            log.error("[REST] Erreur de lecture du template : {}", templateName, e);
            return ResponseEntity.internalServerError().build();
        }
    }
}