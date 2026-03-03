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
        j.id AS id,
        j.id AS id_justificativa,
        j.rppn,
        j.user_justificativa,
        j.user_justificativa AS usuario_nome,
        j.user_avaliador,
        j.acao,
        j.justificativa,
        j.status,
        j.motivo_rejeicao,
        j.data_criacao,
        j.data_avaliacao
      FROM justificativas j
      INNER JOIN restos_a_pagar r ON r.rppn = j.rppn
      ${isAdmin ? '' : 'WHERE r.uo_codigo = ?'}
      ORDER BY j.data_criacao DESC
    `;
    const params = isAdmin ? [] : [auth.uo];

    const [rows] = await db.query(query, params);

    return ok({ status: rows, role: auth.role, uo: auth.uo }, 'Dados obtidos com sucesso.');
  } catch (e) {
    return serverError(e.message);
  }
}
