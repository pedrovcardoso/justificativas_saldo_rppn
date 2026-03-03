import { requireAdmin } from '@/lib/auth';
import { ok, authError, badRequest, serverError } from '@/lib/response';

const ADMIN_FLOW_URL = process.env.ADMIN_FLOW_URL;

export async function GET(request) {
    try {
        const body = Object.fromEntries(new URL(request.url).searchParams);
        const { user, token } = body;

        if (!user || !token) return badRequest('Campos "user" e "token" são obrigatórios.');

        const response = await fetch(ADMIN_FLOW_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: 'get_users', user, token }),
        });

        const data = await response.json();
        return Response.json(data, { status: response.status });
    } catch (e) {
        return serverError(e.message);
    }
}

export async function POST(request) {
    try {
        const authReq = request.clone();
        const admin = await requireAdmin(authReq);
        if (admin.error) return authError(admin);

        const { username, role, uo, action } = admin.body;

        if (!username || !role) return badRequest('Campos "username" e "role" são obrigatórios.');

        const endpoint = action === 'update' ? 'update_user' : 'create_user';

        const response = await fetch(ADMIN_FLOW_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint, user: admin.user, token: admin.body.token, username, role, uo }),
        });

        const data = await response.json();
        return Response.json(data, { status: response.status });
    } catch (e) {
        return serverError(e.message);
    }
}
