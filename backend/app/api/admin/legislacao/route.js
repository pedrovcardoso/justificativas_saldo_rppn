import db from '@/lib/db';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { ok, authError, badRequest, serverError } from '@/lib/response';

export async function GET(request) {
    try {
        const params = new URL(request.url).searchParams;
        const user = params.get('user');
        const token = params.get('token');

        if (!user || !token) return badRequest('Campos "user" e "token" são obrigatórios.');

        const auth = await requireAuth({ json: async () => ({ user, token }) });
        if (auth.error) return authError(auth);

        const [rows] = await db.query('SELECT * FROM legislacao ORDER BY id DESC');
        return ok(rows, 'Legislação obtida com sucesso.');
    } catch (e) {
        return serverError(e.message);
    }
}

export async function POST(request) {
    try {
        const admin = await requireAdmin(request);
        if (admin.error) return authError(admin);

        const { items } = admin.body;

        if (!Array.isArray(items) || items.length === 0) {
            return badRequest('Campo "items" deve ser uma lista não vazia.');
        }

        await db.query('TRUNCATE TABLE legislacao');

        for (const item of items) {
            const { titulo, tipo, numero, ano, esfera, status, ementa, url, tags } = item;
            await db.query(
                `INSERT INTO legislacao (titulo, tipo, numero, ano, esfera, status, ementa, url, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [titulo, tipo, numero, ano, esfera, status, ementa, url, JSON.stringify(tags || [])]
            );
        }

        return ok({}, 'Legislação salva com sucesso.');
    } catch (e) {
        return serverError(e.message);
    }
}
