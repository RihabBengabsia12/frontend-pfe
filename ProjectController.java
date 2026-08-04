package tn.rihab.projectservice.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import tn.rihab.projectservice.model.Project;
import tn.rihab.projectservice.model.ProjectStatus;
import tn.rihab.projectservice.service.ProjectService;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
@CrossOrigin("*")
public class ProjectController {

    private final ProjectService service;

    // --- PRIORITÉ 1 : ROUTES FIXES ---

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Project> upload(
            @RequestParam("title") String title,
            @RequestParam("description") String description,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.saveProject(title, description, file));
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Long>> getStats() {
        return ResponseEntity.ok(service.getProjectStats());
    }

    @GetMapping
    public List<Project> getAll() {
        return service.listAll();
    }

    // --- PRIORITÉ 2 : ROUTES DYNAMIQUES ({id}) ---

    @GetMapping("/{id}")
    public ResponseEntity<Project> getById(@PathVariable("id") UUID id) {
        System.out.println(">>> [DEBUG] Requête GET reçue pour ID: " + id);
        return ResponseEntity.ok(service.getProjectById(id));
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<Resource> downloadFile(@PathVariable("id") UUID id) {
        Resource resource = service.loadFileAsResource(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + resource.getFilename() + "\"")
                .body(resource);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Project> update(@PathVariable("id") UUID id, @RequestBody Project projectDetails) {
        return ResponseEntity.ok(service.updateProject(id, projectDetails));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<Project> updateStatus(@PathVariable("id") UUID id, @RequestParam ProjectStatus status) {
        return ResponseEntity.ok(service.changeStatus(id, status));
    }

    // Correction apportée ici (guillemet refermé)
    @PostMapping("/{id}/extract")
    public ResponseEntity<Project> extractData(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(service.processExtraction(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable("id") UUID id) {
        service.deleteProject(id);
        return ResponseEntity.noContent().build();
    }
}