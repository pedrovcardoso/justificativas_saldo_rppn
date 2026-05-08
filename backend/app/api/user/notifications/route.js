import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ok, serverError, authError } from '@/lib/response';

export async function GET(request) {
    try {
        const auth = await requireAuth(request);
        if (auth.error) return authError(auth);

        const [rows] = await db.query(`
            SELECT n.*, 
                   IF(nl.id IS NOT NULL, TRUE, FALSE) as lida
            FROM notificacoes n
            LEFT JOIN notificacoes_lidas nl ON n.id = nl.notificacao_id AND nl.user = ?
            WHERE n.ativo = TRUE
            ORDER BY n.id DESC
        `, [auth.user]);

        return ok(rows, 'Notificações obtidas com sucesso.');
    } catch (e) {
        return serverError(e.message);
    }
}
