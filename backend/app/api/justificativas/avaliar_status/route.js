import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ok, authError, badRequest, forbidden, serverError } from '@/lib/response';

export async function POST(request) {
    try {
        const auth = await requireAuth(request);
        if (auth.error) return authError(auth);

        if (auth.role !== 'admin') return forbidden();

        const { status, motivo_rejeicao, dados } = auth.body;

        if (!status || !Array.isArray(dados) || dados.length === 0) {
            return badRequest('Campos "status" e "dados" são obrigatórios.');
        }

        const results = [];

        for (const item of dados) {
            const { rppn, id } = item;

            await db.query(
                `UPDATE justificativas
         SET status = ?, motivo_rejeicao = ?, user_avaliador = ?, data_avaliacao = NOW()
         WHERE id = ? AND rppn = ?`,
                [status, motivo_rejeicao || null, auth.user, id, rppn]
            );

            results.push({ success: true, statusCode: '200', message: 'Dados salvos com sucesso.' });
        }

        return ok(results, 'Avaliação concluída.');
    } catch (e) {
        return serverError(e.message);
    }
}
