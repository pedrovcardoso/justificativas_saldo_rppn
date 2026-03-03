import db from '@/lib/db';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { ok, authError, badRequest, notFound, serverError } from '@/lib/response';

export async function GET(request) {
    try {
        const params = new URL(request.url).searchParams;
        const user = params.get('user');
        const token = params.get('token');

        if (!user || !token) return badRequest('Campos "user" e "token" são obrigatórios.');

        const auth = await requireAuth({ json: async () => ({ user, token }) });
        if (auth.error) return authError(auth);

        const [rows] = await db.query('SELECT * FROM notificacoes ORDER BY id DESC');
        return ok(rows, 'Notificações obtidas com sucesso.');
    } catch (e) {
        return serverError(e.message);
    }
}

export async function POST(request) {
    try {
        const admin = await requireAdmin(request);
        if (admin.error) return authError(admin);

        const { titulo, mensagem, tipo, ativo } = admin.body;

        if (!titulo || !mensagem || !tipo) {
            return badRequest('Campos "titulo", "mensagem" e "tipo" são obrigatórios.');
        }

        const [result] = await db.query(
            'INSERT INTO notificacoes (titulo, mensagem, tipo, ativo) VALUES (?, ?, ?, ?)',
            [titulo, mensagem, tipo, ativo !== undefined ? ativo : true]
        );

        return ok({ id: String(result.insertId) }, 'Notificação criada com sucesso.');
    } catch (e) {
        return serverError(e.message);
    }
}

export async function PUT(request) {
    try {
        const admin = await requireAdmin(request);
        if (admin.error) return authError(admin);

        const { id, titulo, mensagem, tipo, ativo } = admin.body;

        if (!id) return badRequest('Campo "id" é obrigatório.');

        const [result] = await db.query(
            'UPDATE notificacoes SET titulo = ?, mensagem = ?, tipo = ?, ativo = ? WHERE id = ?',
            [titulo, mensagem, tipo, ativo, id]
        );

        if (result.affectedRows === 0) return notFound('Notificação não encontrada.');

        return ok({}, 'Notificação atualizada com sucesso.');
    } catch (e) {
        return serverError(e.message);
    }
}

export async function DELETE(request) {
    try {
        const admin = await requireAdmin(request);
        if (admin.error) return authError(admin);

        const { id } = admin.body;

        if (!id) return badRequest('Campo "id" é obrigatório.');

        const [result] = await db.query('DELETE FROM notificacoes WHERE id = ?', [id]);

        if (result.affectedRows === 0) return notFound('Notificação não encontrada.');

        return ok({}, 'Notificação removida com sucesso.');
    } catch (e) {
        return serverError(e.message);
    }
}
