package tn.rihab.adminservice.controller;

import lombok.RequiredArgsConstructor;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tn.rihab.adminservice.service.RoleService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/roles")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class RoleController {

    private final RoleService roleService;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getRoles() {
        return ResponseEntity.ok(roleService.findAllWithPermissions());
    }

    // --- CORRECTION ICI ---
    // On change List<String> en List<UUID> et on appelle getPermissionIds
    @GetMapping("/{id}/permissions")
    public ResponseEntity<List<UUID>> getPermissions(@PathVariable UUID id) {
        return ResponseEntity.ok(roleService.getPermissionIds(id));
    }

    @PutMapping("/{id}/permissions")
    public ResponseEntity<Void> updatePermissions(
            @PathVariable UUID id,
            @RequestBody Map<String, List<UUID>> request) {

        List<UUID> permissionIds = request.get("permissionIds");
        roleService.updateRolePermissions(id, permissionIds);
        return ResponseEntity.ok().build();
    }
}