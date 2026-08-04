import { SpringPage, UserResponse } from '../../../service/admin.service';

export const MOCK_USERS_PAGE: SpringPage<UserResponse> = {
    content: [
        {
            id: 'guest1',
            email: 'guest1@st2i.tn',
            fullName: 'Stagiaire Guest 1',
            role: 'GUEST',
            status: 'PENDING',
            createdAt: '2024-04-01T10:30:00Z'
        },
        {
            id: 'guest2',
            email: 'rihab.stagiaire@compagnie.tn',
            fullName: 'Rihab Stagiaire',
            role: 'GUEST',
            status: 'PENDING',
            createdAt: '2024-04-02T14:15:00Z'
        },
        {
            id: 'guest3',
            email: 'test.guest@demo.tn',
            fullName: 'Test Guest Account',
            role: 'GUEST',
            status: 'PENDING',
            createdAt: '2024-04-03T09:45:00Z'
        },
        {
            id: 'analyst1',
            email: 'analyste1@st2i.tn',
            fullName: 'Analyste Confirmé',
            role: 'ANALYST',
            status: 'ACTIVE',
            createdAt: '2024-03-15T11:20:00Z'
        },
        {
            id: 'admin1',
            email: 'admin@st2i.tn',
            fullName: 'Super Admin',
            role: 'ADMIN',
            status: 'ACTIVE',
            createdAt: '2024-01-01T00:00:00Z'
        }
    ],
    totalElements: 5,
    totalPages: 1,
    number: 0,
    size: 100
};

