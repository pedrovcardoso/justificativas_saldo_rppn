import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ok, authError, serverError } from '@/lib/response';

export async function POST(request) {
    try {
        const auth = await requireAuth(request);
        if (auth.error) return authError(auth);

        const isAdmin = auth.role === 'admin';
        const query = `
      SELECT
        uo_codigo, ue_codigo, ano_origem, documento, funcao, subfuncao,
        programa, projeto_atividade, subprojeto, natureza_item, elemento_item,
        fonte_recurso, procedencia, saldo_rppn, valor_inscrito, valor_pago,
        valor_cancelado, rppn
      FROM restos_a_pagar
      ${isAdmin ? '' : 'WHERE uo_codigo = ?'}
    `;
        const params = isAdmin ? [] : [auth.uo];

        const [rows] = await db.query(query, params);

        return ok({ rows, role: auth.role, uo: auth.uo }, 'Dados obtidos com sucesso.');
    } catch (e) {
        return serverError(e.message);
    }
}
