export const MOCK_AUDIT_EVENTS = [
  {
    actorUserId: "11111111-1111-1111-1111-111111111111",
    entityId: "550e8400-e29b-41d4-a716-446655440001",
    entityName: "AppUser",
    action: "DELETE",
    occurredAt: "2024-04-25T18:44:00Z",
    oldData: "sirine@test.tn"
  },
  {
    actorUserId: "11111111-1111-1111-1111-111111111111",
    entityId: "550e8400-e29b-41d4-a716-446655440002",
    entityName: "AppUser",
    action: "ASSIGN_ROLE",
    occurredAt: "2024-04-25T17:05:00Z",
    newData: "ADMIN"
  },
  {
    actorUserId: "11111111-1111-1111-1111-111111111111",
    entityId: "550e8400-e29b-41d4-a716-446655440003",
    entityName: "AppUser",
    action: "TOGGLE_STATUS",
    occurredAt: "2024-04-24T22:25:00Z",
    oldData: "PENDING",
    newData: "ACTIVE"
  }
];

