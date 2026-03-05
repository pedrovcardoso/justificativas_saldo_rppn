import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ok, authError, forbidden, notFound, serverError } from '@/lib/response';

export async function DELETE(request, { params }) {
    try {
        const auth = await requireAuth(request);
        if (auth.error) return authError(auth);
        if (auth.role !== 'admin') return forbidden();

        const { id } = params;

        const [result] = await db.query(
            'DELETE FROM tipos_justificativa WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) return notFound('Tipo de justificativa não encontrado.');

        return ok({}, 'Tipo excluído com sucesso.');
    } catch (e) {
        return serverError(e.message);
    }
}
